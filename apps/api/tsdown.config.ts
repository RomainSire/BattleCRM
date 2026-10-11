import { defineConfig } from 'tsdown';

// Dependencies stay external: the image installs them with `pnpm deploy --prod`, next to `drizzle/`.
// Except the messages: their compiled output is git-ignored, so `pnpm deploy` would leave it out.
export default defineConfig({
  entry: ['src/main.ts', 'src/migrate.ts'],
  platform: 'node',
  noExternal: ['@battlecrm/i18n'],
  format: 'esm',
  dts: false,
  fixedExtension: false,
});
