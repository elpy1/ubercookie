import { defineConfig } from 'vite';

// In development the app runs at http://localhost:5173 and proxies every /api
// request to the FastAPI backend at :8000. Keeping it same-origin (rather than
// using CORS) means cookies and the HTTP cache behave exactly as they would in
// production — which matters a lot for the cache/ETag tracking vectors.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
