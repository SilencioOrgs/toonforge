import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function workspaceBridgePlugin() {
  return {
    name: 'toonforge-workspace-bridge',
    configureServer(server: { middlewares: { use: (prefix: string, fn: any) => void } }) {
      server.middlewares.use('/api', async (req: any, res: any, next: () => void) => {
        try {
          const bridge = await import('./server/bridge.mjs');
          await bridge.handleApiRequest(req, res, repoRoot);
        } catch {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), workspaceBridgePlugin()],
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
