import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The API runs on its own port in dev; production serves both on the same origin (spec stack §1).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
