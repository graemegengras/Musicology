import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Spotify only accepts loopback IPs (not "localhost") as redirect URIs.
  server: { host: '127.0.0.1', port: 5173 },
});
