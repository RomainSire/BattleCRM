import { OnlineContext } from '@battlecrm/ui';
import type { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { devicePersistence } from './device-data.ts';
import { useIsOnline } from './online.ts';
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
        <OnlineProvider>
          <RouterProvider router={router} />
        </OnlineProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}

/** Gives the shared components whether the API can be reached: offline, nothing saves (ADR 0004). */
function OnlineProvider({ children }: { children: ReactNode }) {
  return <OnlineContext value={useIsOnline()}>{children}</OnlineContext>;
}
