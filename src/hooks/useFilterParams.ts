import { useSearchParams } from 'react-router'
import { useMemo, useCallback } from 'react'
import type { TurnKind } from '@shared/types.ts'

export const ALL_TURN_KINDS: TurnKind[] = ['user', 'assistant', 'system', 'attachment', 'error', 'orphan_tool_result']

export interface TranscriptFilterState {
  kinds: TurnKind[]
  tools: string[]
  q: string
}

/** Message-kind/tool/search filters for the transcript view, kept in the URL
 * so a filtered view is shareable and survives a reload. */
export function useFilterParams() {
  const [params, setParams] = useSearchParams()

  const state = useMemo<TranscriptFilterState>(() => {
    const kindsParam = params.get('kinds')
    const toolsParam = params.get('tools')
    return {
      kinds: kindsParam ? (kindsParam.split(',').filter(Boolean) as TurnKind[]) : ALL_TURN_KINDS,
      tools: toolsParam ? toolsParam.split(',').filter(Boolean) : [],
      q: params.get('q') ?? '',
    }
  }, [params])

  const setKinds = useCallback(
    (kinds: TurnKind[]) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (kinds.length === ALL_TURN_KINDS.length) next.delete('kinds')
          else next.set('kinds', kinds.join(','))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setTools = useCallback(
    (tools: string[]) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (tools.length === 0) next.delete('tools')
          else next.set('tools', tools.join(','))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setQuery = useCallback(
    (q: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (!q) next.delete('q')
          else next.set('q', q)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { ...state, setKinds, setTools, setQuery }
}
