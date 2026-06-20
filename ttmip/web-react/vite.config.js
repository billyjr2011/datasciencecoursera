import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `npm run dev`, proxy API calls to the TTMIP backend so the SPA can run
// on :5173 while the API runs on :4000 — same-origin from the browser's view.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
