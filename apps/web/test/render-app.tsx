import { createMemoryHistory } from '@tanstack/react-router';
import { render } from 'vitest-browser-react';

import { App } from '../src/app.tsx';
import { createQueryClient } from '../src/query-client.ts';
import { createAppRouter } from '../src/router.tsx';

/** Renders the whole SPA at a path, as main.tsx does, on an in-memory history. */
export async function renderApp(path = '/') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const screen = await render(<App router={router} queryClient={createQueryClient()} />);
  return { screen, router };
}
