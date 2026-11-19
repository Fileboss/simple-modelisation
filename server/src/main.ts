import path from 'node:path';
import { startSyncServer } from './sync-server.ts';

const {
	PORT = '3000',
	// sqlite keeps Shared Projects on disk; none relays them, in memory, while someone has them open.
	STORAGE = 'sqlite',
	DATA_DIR = path.resolve('data'),
	// The MCP endpoint: on by default with storage, off without (it works on stored documents).
	MCP,
	// Documents held in memory at once.
	MAX_DOCUMENTS = '500',
	// Documents one address may have open at once.
	MAX_DOCUMENTS_PER_IP = '20',
	STATIC_DIR,
	// Set to true only behind a reverse proxy that sets X-Forwarded-For.
	TRUST_PROXY
} = process.env;

if (STORAGE !== 'sqlite' && STORAGE !== 'none') {
	throw new Error(`STORAGE must be sqlite or none, not ${STORAGE}`);
}
if (MCP !== undefined && MCP !== 'on' && MCP !== 'off') {
	throw new Error(`MCP must be on or off, not ${MCP}`);
}
const positive = (name: string, value: string) => {
	const number = Number(value);
	if (!Number.isInteger(number) || number < 1) {
		throw new Error(`${name} must be a positive integer, not ${value}`);
	}
	return number;
};
const maxDocuments = positive('MAX_DOCUMENTS', MAX_DOCUMENTS);
const maxDocumentsPerIp = positive('MAX_DOCUMENTS_PER_IP', MAX_DOCUMENTS_PER_IP);

const server = await startSyncServer({
	port: Number(PORT),
	storage: STORAGE,
	dataDir: STORAGE === 'sqlite' ? DATA_DIR : undefined,
	mcp: MCP === undefined ? undefined : MCP === 'on',
	maxDocuments,
	maxDocumentsPerIp,
	staticDir: STATIC_DIR,
	trustProxy: TRUST_PROXY === 'true'
});
const where = STORAGE === 'sqlite' ? `data in ${DATA_DIR}` : 'relay: nothing stored';
console.log(`simple-modelisation listening on :${server.port} (${where})`);

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.once(signal, () => void server.stop().then(() => process.exit(0)));
}
