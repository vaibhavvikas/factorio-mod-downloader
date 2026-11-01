import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes freshness
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection / cache time
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
