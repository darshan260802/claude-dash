import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ShareMode } from '@shared/types.ts'

/** The one query every viewer — owner or visitor, any mode — needs: it's
 * what App.tsx uses to pick the owner router or the stripped viewer router.
 * Polled slowly so an already-open visitor tab notices if the owner
 * narrows/stops the share. */
export function useShareContext() {
  return useQuery({
    queryKey: ['share-context'],
    queryFn: () => api.shareContext(),
    refetchInterval: 15_000,
  })
}

/** Owner-only — the Share page's live status, including the code and
 * shared-item list. Polls at 1s while a tunnel is coming up (first run can
 * take a while — cloudflared download — so the UI needs to notice the
 * moment it's ready) and 15s once settled. Self-gates on ownership (rather
 * than trusting every call site to remember to) so a global-mode visitor's
 * open tabs — which do render owner-only components like ShareButton and
 * ShareStatusBanner, just inert for them — don't each poll an endpoint the
 * server would 403 anyway. */
export function useShareStatus() {
  const { data: ctx } = useShareContext()
  return useQuery({
    queryKey: ['share-status'],
    queryFn: () => api.shareStatus(),
    enabled: ctx?.isOwner === true,
    refetchInterval: (query) => (query.state.data?.state === 'starting' ? 1000 : 15_000),
  })
}

function invalidateShare(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['share-status'] })
  queryClient.invalidateQueries({ queryKey: ['share-context'] })
}

export function useStartShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mode: ShareMode) => api.startShare(mode),
    onSuccess: () => invalidateShare(queryClient),
  })
}

export function useStopShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.stopShare(),
    onSuccess: () => invalidateShare(queryClient),
  })
}

/** Throws with `error.status === 409` (and `error.body.error ===
 * 'global_share_active'`) when a global share is already running and
 * `replaceGlobal` wasn't set — the caller (ShareButton) catches that
 * specifically to show the confirm dialog. */
export function useAddToShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: { sessionId: string; agentId?: string; replaceGlobal?: boolean }) => api.addToShare(item),
    onSuccess: () => invalidateShare(queryClient),
  })
}

export function useRemoveFromShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: { sessionId: string; agentId?: string }) => api.removeFromShare(item),
    onSuccess: () => invalidateShare(queryClient),
  })
}
