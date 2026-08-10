import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TurnKind, Liveness } from '@shared/types.ts'

const PAGE_SIZE = 80
const POLL_MS = 3000

export interface TurnFilterOpts {
  kinds?: TurnKind[]
  tools?: string[]
  q?: string
}

export function useSessionTurns(sessionId: string | undefined, liveness: Liveness | undefined, filters: TurnFilterOpts = {}) {
  return useInfiniteQuery({
    queryKey: ['session-turns', sessionId, filters],
    queryFn: ({ pageParam }) => api.sessionTurns(sessionId!, { cursor: pageParam, limit: PAGE_SIZE, ...filters }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!sessionId,
    refetchInterval: liveness && liveness !== 'ended' ? POLL_MS : false,
  })
}

export function useSubagentTurns(sessionId: string | undefined, agentId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['subagent-turns', sessionId, agentId],
    queryFn: ({ pageParam }) => api.subagentTurns(sessionId!, agentId!, { cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && !!sessionId && !!agentId,
  })
}
