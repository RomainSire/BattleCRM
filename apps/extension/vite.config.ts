import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The sidebar's plugins for its tests (vitest.config.ts): WXT builds with the same ones, given in
 * wxt.config.ts, and never reads this file.
 */
export default defineConfig({ plugins: [react(), tailwindcss()] });
