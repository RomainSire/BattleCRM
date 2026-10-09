import { defineConfig } from 'tsdown';

// Dependencies stay external: the image installs them with `pnpm deploy --prod`, next to `drizzle/`.
export default defineConfig({
  entry: ['src/main.ts', 'src/migrate.ts'],
  platform: 'node',
  format: 'esm',
  dts: false,
  fixedExtension: false,
});
