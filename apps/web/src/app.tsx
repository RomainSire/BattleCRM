import type { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';

import { devicePersistence } from './device-data.ts';
import type { createAppRouter } from './router.tsx';
import { ThemeProvider } from './theme/theme-provider.tsx';

export function App({
  router,
  queryClient,
}: {
  router: ReturnType<typeof createAppRouter>;
  queryClient: QueryClient;
}) {
  return (
    <ThemeProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={devicePersistence}>
        <RouterProvider router={router} />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
