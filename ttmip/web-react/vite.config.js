import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLEFILE=1 inlines everything into one self-contained index.html (the live
// demo — openable from disk, hostable anywhere, no backend required).
const singleFile = process.env.SINGLEFILE === '1';

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  server: {
    port: 5173,
    // During `npm run dev`, proxy API calls to the TTMIP backend so the SPA can
    // run on :5173 while the API runs on :4000 — same-origin from the browser.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
