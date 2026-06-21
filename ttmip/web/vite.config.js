import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Runnable entry for the converted dashboard (index.jsx). The original
// standalone index.html still lives here and is left untouched — this Vite
// project builds only app.html, which mounts the JSX component.
//
// SINGLEFILE=1 inlines everything into one self-contained HTML (the JSX
// prototype — openable from disk, no backend required).
const singleFile = process.env.SINGLEFILE === '1';

export default defineConfig({
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  server: {
    port: 5174,
    // Open http://localhost:5174/app.html to view the mounted dashboard.
    // Proxy API calls to the TTMIP backend so the dashboard hydrates LIVE data.
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    outDir: 'dist-jsx',
    rollupOptions: { input: { app: 'app.html' } },
  },
});
