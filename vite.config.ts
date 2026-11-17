import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	// The sync server (`server/`, port 3000) answers /sync in development.
	// ELK is imported on demand (ADR 0006): optimise it up front, or the dev server
	// discovers it on the first Tidy up and the already-requested chunk goes stale.
	optimizeDeps: { include: ['elkjs/lib/elk.bundled.js'] },
	server: {
		proxy: { '/sync': { target: 'ws://localhost:3000', ws: true } }
	}
});
