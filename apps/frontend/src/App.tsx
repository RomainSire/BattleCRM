import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppRouter } from '@/routes'

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Personal tool — data only changes on user mutations, which invalidate explicitly.
            // 2 min prevents unnecessary refetches on window focus / component remount.
            staleTime: 2 * 60 * 1000,
            // Keep unused cache entries for 10 min (default: 5 min).
            // Avoids re-fetching recently-seen pages on navigation.
            gcTime: 10 * 60 * 1000,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppRouter />
        <Toaster position="bottom-right" />
        <ReactQueryDevtools initialIsOpen={false} />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
