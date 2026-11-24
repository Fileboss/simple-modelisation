import type { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { z } from 'zod';
import type { ProjectAccess, RegisterTool } from './mcp.ts';
import { projectArgument } from './mcp.ts';
import { ToolError } from './mcp-error.ts';
import { registerWriteTools } from './mcp-write.ts';

/** The most operations one batch takes. */
export const MAX_OPERATIONS = 200;

type WriteTool = { schema: z.ZodObject; run: (args: unknown) => Promise<unknown> };

/** `{ "$ref": N }`: the id operation N returned. */
const isReference = (value: object): value is { $ref: unknown } =>
	Object.keys(value).length === 1 && '$ref' in value;

/** `value` with every `{ "$ref": N }` replaced by the id operation N returned. */
function resolve(value: unknown, results: unknown[], at: number): unknown {
	if (Array.isArray(value)) return value.map((item) => resolve(item, results, at));
	if (!value || typeof value !== 'object') return value;
	if (isReference(value)) {
		const n = value.$ref;
		if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n >= at) {
			throw new ToolError(
				`{ "$ref": ${JSON.stringify(n)} } names no earlier operation: use 1 to ${at - 1}.`
			);
		}
		const id = (results[n - 1] as { id?: unknown } | null)?.id;
		if (typeof id !== 'string') throw new ToolError(`Operation ${n} returned no id to refer to.`);
		return id;
	}
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, resolve(item, results, at)])
	);
}

/** The write tools, each running its change on `copy` rather than a Shared Project. */
function writeToolsOn(copy: ProjectDocument | undefined) {
	const onCopy: ProjectAccess = {
		read: async (_reference, use) => use(copy!),
		write: async (_reference, change) => change(copy!),
		writeCopy: async (_reference, change) => change(copy!, () => undefined)
	};
	const tools = new Map<string, WriteTool>();
	registerWriteTools(
		(name, _description, shape, run) =>
			tools.set(name, { schema: z.object(shape), run: run as WriteTool['run'] }),
		onCopy
	);
	return tools;
}

/**
 * The batch tool: write operations played all or nothing on a copy of a Shared
 * Project, applied in one transaction. Each runs the same code as its own tool,
 * registered a second time against the copy.
 */
export function registerBatchTool(tool: RegisterTool, access: ProjectAccess) {
	const names = [...writeToolsOn(undefined).keys()] as [string, ...string[]];

	tool(
		'batch',
		`Plays several write operations in one call, all or nothing: when one fails, none is applied, and the error names it; otherwise open browsers receive them as one change. Each operation is { tool, args }: a write tool (${names.join(', ')}) and its arguments without project. In place of any id or name argument, { "$ref": N } stands for the id operation N returned (from 1), to use what an earlier operation created. Up to ${MAX_OPERATIONS} operations; answers each operation's result in order.`,
		{
			project: projectArgument,
			operations: z
				.array(
					z.object({
						tool: z.enum(names),
						args: z.record(z.string(), z.unknown()).optional()
					})
				)
				.min(1)
				.max(MAX_OPERATIONS)
		},
		({ project, operations }) =>
			access.writeCopy(project, async (p, checkGrowth) => {
				const tools = writeToolsOn(p);
				const results: unknown[] = [];
				for (const [index, operation] of operations.entries()) {
					const at = index + 1;
					const { schema, run } = tools.get(operation.tool)!;
					try {
						const args = resolve(operation.args ?? {}, results, at) as Record<string, unknown>;
						const parsed = schema.safeParse({ ...args, project });
						if (!parsed.success) throw new ToolError(z.prettifyError(parsed.error));
						results.push(await run(parsed.data));
						checkGrowth();
					} catch (error) {
						// Any failure names its operation, so that the agent knows which one to fix.
						const message = error instanceof Error ? error.message : String(error);
						throw new ToolError(`Operation ${at} (${operation.tool}): ${message}`);
					}
				}
				return { results };
			})
	);
}
