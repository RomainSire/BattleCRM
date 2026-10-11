import { createMemoryHistory } from '@tanstack/react-router';
import { render } from 'vitest-browser-react';

import { createApiClient } from '../src/api-client.ts';
import { App } from '../src/app.tsx';
import { createQueryClient } from '../src/query-client.ts';
import { createAppRouter } from '../src/router.tsx';
import { fakeApi } from './fake-api.ts';

/** Renders the whole SPA at a path, as main.tsx does, on an in-memory history and a fake API (a signed-in User by default). */
export async function renderApp(path = '/', api = fakeApi()) {
  const queryClient = createQueryClient();
  const router = createAppRouter({
    api: createApiClient(api.fetch),
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={queryClient} />);
  return { screen, router, api };
}
