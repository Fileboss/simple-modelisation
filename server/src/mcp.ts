import type { Hocuspocus } from '@hocuspocus/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as Y from 'yjs';
import { z } from 'zod';
import type { DocumentStore } from './document-store.ts';
import { ToolError } from './mcp-error.ts';
import { describeDiagram, describeProject, mcdSql } from './mcp-views.ts';
import { registerWriteTools } from './mcp-write.ts';

/** The path of the MCP endpoint, beside the app and the sync. */
export const MCP_PATH = '/mcp';

const UUID_IN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

type Options = {
	instance: Hocuspocus;
	store: DocumentStore;
	log: (message: string) => void;
	maxRequestsPerMinute: number;
	maxDocumentBytes: number;
	clientIp: (request: IncomingMessage) => string;
};

export type ProjectAccess = {
	/** Reads a Shared Project; the document stays loaded for the next call. */
	read<T>(reference: string, use: (project: ProjectDocument) => T): Promise<T>;
	/** Changes a Shared Project in one transaction that open browsers receive live. */
	write<T>(reference: string, change: (project: ProjectDocument) => T): Promise<T>;
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
	const { instance, store, log, maxRequestsPerMinute, maxDocumentBytes, clientIp } = options;
	const requests = new Map<string, number[]>();

	const open = async (reference: string) => {
		const id = UUID_IN.exec(reference.toLowerCase())?.[0];
		if (!id) throw new ToolError('Not a Share link or Project id.');
		// Only Shared Projects that exist: an agent never creates one by naming it.
		if (!instance.documents.has(id) && !store.has(id)) {
			throw new ToolError('No Shared Project has this link.');
		}
		return instance.openDirectConnection(id, { agent: true });
	};
	const wrap = <T>(doc: Y.Doc, use: (project: ProjectDocument) => T): T => {
		const project = new ProjectDocument(doc);
		try {
			return use(project);
		} finally {
			project.destroy();
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
				// The sync's size limit applies to agents too.
				const size = Y.encodeStateAsUpdate(connection.document!).byteLength;
				if (size > maxDocumentBytes) {
					log(`refused mcp document size: ${connection.document!.name} ${size} bytes`);
					throw new ToolError('This Shared Project is full: it takes no more changes.');
				}
				let result: ReturnType<typeof change> | undefined;
				await connection.transact((doc) => {
					result = wrap(doc, change);
				});
				return result!;
			} finally {
				await connection.disconnect();
			}
		}
	};

	const createServer = () => {
		const server = new McpServer({ name: 'simple-modelisation', version: '0.1.0' });
		const tool: RegisterTool = (name, description, inputSchema, run) =>
			server.registerTool(name, { description, inputSchema }, (async (args: never) => {
				try {
					const result = await run(args);
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
			'The elements of a Diagram with their ids: Components and Connections, or Entities, Attributes and Associations with their Cardinalities.',
			{ project: projectArgument, diagram: z.string().describe('Diagram id or exact name.') },
			({ project, diagram }) => access.read(project, (p) => describeDiagram(p, diagram))
		);
		tool(
			'get_mcd_sql',
			"An MCD's MLD (Looping notation) and PostgreSQL script, with warnings.",
			{ project: projectArgument, diagram: z.string().describe('MCD id or exact name.') },
			({ project, diagram }) => access.read(project, (p) => mcdSql(p, diagram))
		);
		registerWriteTools(tool, access);
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

/** Registers a tool whose JSON answer or ToolError message goes back to the agent. */
export type RegisterTool = <Shape extends z.ZodRawShape>(
	name: string,
	description: string,
	inputSchema: Shape,
	run: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>
) => void;
