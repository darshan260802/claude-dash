import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SettingsPatchDTO } from '@shared/types.ts'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings(),
    refetchInterval: 5000,
  })
}

export function usePatchSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsPatchDTO) => api.patchSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
