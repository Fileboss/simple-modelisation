import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.json': 'application/json',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2'
};

/**
 * Serves the built app: existing files as they are (hashed assets cached for
 * good), any other path as index.html so client routes like /p/<id> load the app.
 */
export async function serveStatic(
	root: string,
	request: IncomingMessage,
	response: ServerResponse
) {
	const urlPath = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
	const requested = path.resolve(root, `.${urlPath}`);
	const inside = requested.startsWith(path.resolve(root) + path.sep);
	const file = inside && (await isFile(requested)) ? requested : path.join(root, 'index.html');

	const isAsset = file.includes(`${path.sep}assets${path.sep}`);
	const stream = createReadStream(file);
	stream.once('open', () => {
		response.writeHead(200, {
			'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
			'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
		});
		stream.pipe(response);
	});
	stream.once('error', () => {
		if (!response.headersSent) response.writeHead(404);
		response.end();
	});
}

async function isFile(file: string): Promise<boolean> {
	try {
		return (await stat(file)).isFile();
	} catch {
		return false;
	}
}
