import path from 'node:path';
import { startSyncServer } from './sync-server.ts';

const {
	PORT = '3000',
	DATA_DIR = path.resolve('data'),
	STATIC_DIR,
	// Set to true only behind a reverse proxy that sets X-Forwarded-For.
	TRUST_PROXY
} = process.env;

const server = await startSyncServer({
	port: Number(PORT),
	dataDir: DATA_DIR,
	staticDir: STATIC_DIR,
	trustProxy: TRUST_PROXY === 'true'
});
console.log(`simple-modelisation listening on :${server.port} (data in ${DATA_DIR})`);

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.once(signal, () => void server.stop().then(() => process.exit(0)));
}
