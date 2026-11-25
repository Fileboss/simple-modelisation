import type { Document, Hocuspocus } from '@hocuspocus/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as Y from 'yjs';
import { z } from 'zod';
import type { DocumentStore } from './document-store.ts';
import { ToolError } from './mcp-error.ts';
import { describeDiagram, describeProject, exportDiagrams, mcdSql } from './mcp-views.ts';
import { registerBatchTool } from './mcp-batch.ts';
import { registerWriteTools } from './mcp-write.ts';

/** The path of the MCP endpoint, beside the app and the sync. */
export const MCP_PATH = '/mcp';

/** The release, from the root package.json (in the image too), told to MCP clients. */
const VERSION = (
	JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
		version: string;
	}
).version;

const UUID_IN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

type Options = {
	instance: Hocuspocus;
	store: DocumentStore;
	log: (message: string) => void;
	maxRequestsPerMinute: number;
	maxDocumentBytes: number;
	/** Documents held in memory at once, as for the sync. */
	maxDocuments: number;
	clientIp: (request: IncomingMessage) => string;
};

export type ProjectAccess = {
	/** Reads a Shared Project; the document stays loaded for the next call. */
	read<T>(reference: string, use: (project: ProjectDocument) => T): Promise<T>;
	/** Changes a Shared Project in one transaction that open browsers receive live. */
	write<T>(reference: string, change: (project: ProjectDocument) => T): Promise<T>;
	/**
	 * Runs `change` on a copy of a Shared Project, then applies all it did in
	 * one transaction; when it throws, or makes the Shared Project too big, it is
	 * left as it was. `checkGrowth` throws once far too much was added, for a
	 * change of many steps to stop early.
	 */
	writeCopy<T>(
		reference: string,
		change: (project: ProjectDocument, checkGrowth: () => void) => Promise<T>
	): Promise<T>;
};

export const projectArgument = z
	.string()
	.describe('The Share link of a Shared Project (https://…/s/<id>) or its id.');

/**
 * The MCP endpoint (Streamable HTTP, stateless): AI agents read and edit
 * Shared Projects given their Share link, through a direct connection to the
 * synced document, so open browsers see their edits live.
 */
export function createMcpHandler(options: Options) {
	const { instance, store, log, maxRequestsPerMinute, maxDocumentBytes, maxDocuments, clientIp } =
		options;
	const requests = new Map<string, number[]>();

	const open = async (reference: string) => {
		const id = UUID_IN.exec(reference.toLowerCase())?.[0];
		if (!id) throw new ToolError('Not a Share link or Project id.');
		// Only Shared Projects that exist: an agent never creates one by naming it.
		if (!instance.documents.has(id) && !store.has(id)) {
			throw new ToolError('No Shared Project has this link.');
		}
		// Loading it would take memory past what the server allows.
		if (!instance.documents.has(id) && instance.documents.size >= maxDocuments) {
			throw new ToolError('The server is busy: try again later.');
		}
		return instance.openDirectConnection(id, { agent: true });
	};
	const wrap = <T>(doc: Y.Doc, use: (project: ProjectDocument) => T): T => {
		const project = new ProjectDocument(doc, { undo: false });
		try {
			return use(project);
		} finally {
			project.destroy();
		}
	};

	// The sync's size limit applies to agents too.
	const checkSize = (doc: Document, size = Y.encodeStateAsUpdate(doc).byteLength) => {
		if (size > maxDocumentBytes) {
			log(`refused mcp document size: ${doc.name} ${size} bytes`);
			throw new ToolError('This Shared Project is full: it takes no more changes.');
		}
	};

	const access: ProjectAccess = {
		async read(reference, use) {
			const connection = await open(reference);
			try {
				return wrap(connection.document!, use);
			} finally {
				// A read changes nothing: no immediate store, and the document stays warm.
				await connection.disconnect({ unloadImmediately: false });
			}
		},
		async write(reference, change) {
			const connection = await open(reference);
			try {
				checkSize(connection.document!);
				let result: ReturnType<typeof change> | undefined;
				await connection.transact((doc) => {
					result = wrap(doc, change);
				});
				return result!;
			} finally {
				await connection.disconnect();
			}
		},
		async writeCopy(reference, change) {
			const connection = await open(reference);
			try {
				const doc = connection.document!;
				const state = Y.encodeStateAsUpdate(doc);
				checkSize(doc, state.byteLength);
				const copy = new Y.Doc();
				const checkCopy = () => {
					const size = Y.encodeStateAsUpdate(copy).byteLength;
					if (size <= maxDocumentBytes) return;
					log(`refused mcp changes size: ${doc.name} ${size} bytes`);
					throw new ToolError(
						'These changes would make the Shared Project too big: none was applied.'
					);
				};
				let added = 0;
				let result: Awaited<ReturnType<typeof change>>;
				let update: Uint8Array;
				try {
					Y.applyUpdate(copy, state);
					const before = Y.encodeStateVector(copy);
					copy.on('update', (bytes: Uint8Array) => (added += bytes.byteLength));
					const project = new ProjectDocument(copy, { undo: false });
					try {
						result = await change(project, () => {
							// Measured only once as much was written: an edit may replace another.
							if (added <= maxDocumentBytes) return;
							checkCopy();
							added = 0;
						});
					} finally {
						project.destroy();
					}
					// Many changes land at once: the size they reach counts, not only the one before.
					checkCopy();
					update = Y.encodeStateAsUpdate(copy, before);
				} finally {
					copy.destroy();
				}
				await connection.transact((target) => Y.applyUpdate(target, update));
				return result;
			} finally {
				await connection.disconnect();
			}
		}
	};

	const createServer = () => {
		const server = new McpServer({ name: 'simple-modelisation', version: VERSION });
		const tool: RegisterTool = (name, description, inputSchema, run) =>
			server.registerTool(name, { description, inputSchema }, (async (args: never) => {
				try {
					const result = await run(args);
					if (result instanceof ToolContent) return { content: result.content };
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				} catch (error) {
					if (!(error instanceof ToolError)) throw error;
					return { isError: true, content: [{ type: 'text', text: error.message }] };
				}
			}) as never);

		tool(
			'get_project',
			'A Shared Project: its name and Diagrams (System design diagrams and MCDs).',
			{ project: projectArgument },
			({ project }) => access.read(project, describeProject)
		);
		tool(
			'get_diagram',
			'The elements of a Diagram with their ids: Components and Connections, or Entities, Attributes and Associations with their Cardinalities; its Notes, Zones or Areas.',
			{ project: projectArgument, diagram: z.string().describe('Diagram id or exact name.') },
			({ project, diagram }) => access.read(project, (p) => describeDiagram(p, diagram))
		);
		tool(
			'export_project',
			"The whole Project as the app's JSON file (Export, Project (JSON)): a copy the user can import back.",
			{ project: projectArgument },
			({ project }) => access.read(project, (p) => p.toFile())
		);
		tool(
			'get_mcd_sql',
			"An MCD's MLD (Looping notation) and PostgreSQL script, with warnings.",
			{ project: projectArgument, diagram: z.string().describe('MCD id or exact name.') },
			({ project, diagram }) => access.read(project, (p) => mcdSql(p, diagram))
		);
		tool(
			'export_diagram',
			'A Diagram drawn as an SVG image (plain shapes on white: opens in browsers, on GitHub, in design tools and slides); without a diagram, every Diagram of the Project. Diagrams with nothing in them are not drawn.',
			{
				project: projectArgument,
				diagram: z.string().optional().describe('Diagram id or exact name; omit for all.'),
				notation: z
					.enum(['merise', 'uml'])
					.optional()
					.describe(
						"How MCDs are drawn: Merise (Looping's style, the default) or UML class diagram; ignored for System design diagrams."
					),
				types: z
					.boolean()
					.optional()
					.describe(
						"Show each Attribute's PostgreSQL type beside it in Merise (default false); ignored in UML, which always writes the Data types, and on System design diagrams."
					),
				legend: z
					.boolean()
					.optional()
					.describe(
						'Draw a Legend under a System design diagram naming its Flows, Providers, Hostings and Runtimes (default true); MCDs have none.'
					)
			},
			async ({ project, diagram, legend, notation, types }) => {
				const { images, empty } = await access.read(project, (p) =>
					exportDiagrams(p, diagram, { legend, notation, types })
				);
				const note = [
					images.length
						? `${images.map((i) => i.name).join(', ')} drawn as SVG.`
						: 'No Diagram to draw.',
					empty.length ? `Empty, not drawn: ${empty.join(', ')}.` : ''
				]
					.filter(Boolean)
					.join(' ');
				// A note, then each image as its SVG resource.
				return new ToolContent([
					{ type: 'text', text: note },
					...images.map((image) => ({
						type: 'resource',
						resource: {
							uri: `diagram:///${image.id}.svg`,
							mimeType: 'image/svg+xml',
							text: image.svg
						}
					}))
				]);
			}
		);
		registerWriteTools(tool, access);
		registerBatchTool(tool, access);
		return server;
	};

	return async (request: IncomingMessage, response: ServerResponse) => {
		const ip = clientIp(request);
		const recent = (requests.get(ip) ?? []).filter((at) => Date.now() - at < 60_000);
		// Forget addresses that went quiet, so the table does not grow with every client ever seen.
		if (requests.size > 1000) {
			for (const [address, times] of requests) {
				if (times.every((at) => Date.now() - at >= 60_000)) requests.delete(address);
			}
		}
		if (recent.length >= maxRequestsPerMinute) {
			log(`refused mcp rate limit: ${ip}`);
			response.writeHead(429).end();
			return;
		}
		requests.set(ip, [...recent, Date.now()]);

		const server = createServer();
		const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
		// A rejection here would be unhandled and stop the whole server.
		response.on('close', () => {
			transport.close().catch((error: unknown) => log(`mcp close: ${String(error)}`));
			server.close().catch((error: unknown) => log(`mcp close: ${String(error)}`));
		});
		await server.connect(transport);
		await transport.handleRequest(request, response);
	};
}

/** A tool's answer as MCP content (a resource, say) rather than JSON text. */
export class ToolContent {
	readonly content: unknown[];
	constructor(content: unknown[]) {
		this.content = content;
	}
}

/** Registers a tool whose JSON answer (or ToolContent) or ToolError message goes back to the agent. */
export type RegisterTool = <Shape extends z.ZodRawShape>(
	name: string,
	description: string,
	inputSchema: Shape,
	run: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>
) => void;
