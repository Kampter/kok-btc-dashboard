import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { getRouter } from './router'
import { queryClient } from './lib/trpc'

hydrateRoot(
  document.getElementById('app')!,
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={getRouter()} />
    </QueryClientProvider>
  </StrictMode>,
)
