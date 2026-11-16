import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	// The sync server (`server/`, port 3000) answers /sync in development.
	server: {
		proxy: { '/sync': { target: 'ws://localhost:3000', ws: true } }
	}
});
