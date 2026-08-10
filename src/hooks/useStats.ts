import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const POLL_MS = 3000

export function useStats(opts: { from?: string; to?: string; project?: string; groupBy?: 'day' | 'hour' | 'model' | 'project' | 'tool' } = {}) {
  return useQuery({
    queryKey: ['stats', opts],
    queryFn: () => api.stats(opts),
    refetchInterval: POLL_MS,
  })
}
