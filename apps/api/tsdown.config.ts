import { defineConfig } from 'tsdown';

// Dependencies stay external: the image installs them with `pnpm deploy --prod`, next to `drizzle/`.
// Except the workspace packages: the contract is TypeScript source, and the compiled messages are
// git-ignored, so `pnpm deploy` would leave them out.
export default defineConfig({
  entry: ['src/main.ts', 'src/migrate.ts'],
  platform: 'node',
  noExternal: ['@battlecrm/contract', '@battlecrm/i18n'],
  format: 'esm',
  dts: false,
  fixedExtension: false,
});
