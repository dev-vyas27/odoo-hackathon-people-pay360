'use client'

/**
 * Client-side providers, mounted once in the dashboard layout.
 *
 * The QueryClient is created inside `useState` rather than at module scope on
 * purpose: a module-level client is shared between every request on the server,
 * so one user's cached employee list can be handed to the next user. Creating it
 * per component instance keeps the cache per browser tab, where it belongs.
 */
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * HR data changes on a human timescale. 30s of staleness removes
             * the refetch storm you get when a user tabs between screens,
             * without anyone noticing stale numbers during a demo.
             */
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // A 401 or 403 will not become a 200 on the third attempt.
            retry: (failureCount, error) => {
              const status = (error as { status?: number }).status
              if (status && status >= 400 && status < 500) return false
              return failureCount < 2
            },
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
