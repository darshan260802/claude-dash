import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TurnKind } from '@shared/types.ts'

export function useSearch(opts: { q: string; project?: string; kinds?: TurnKind[]; limit?: number }) {
  return useQuery({
    queryKey: ['search', opts],
    queryFn: () => api.search(opts),
    enabled: opts.q.trim().length > 0,
  })
}
