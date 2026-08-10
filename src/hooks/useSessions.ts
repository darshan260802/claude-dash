import { useQuery } from '@tanstack/react-query'
import { api, type SessionFilters } from '@/lib/api'

const POLL_MS = 3000

export function useSessions(filters: SessionFilters = {}) {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => api.sessions(filters),
    refetchInterval: POLL_MS,
  })
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => api.session(id!),
    enabled: !!id,
    refetchInterval: POLL_MS,
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.projects(),
    refetchInterval: POLL_MS,
  })
}

export function useProject(key: string | undefined) {
  return useQuery({
    queryKey: ['project', key],
    queryFn: () => api.project(key!),
    enabled: !!key,
    refetchInterval: POLL_MS,
  })
}
