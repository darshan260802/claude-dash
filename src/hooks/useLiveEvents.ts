import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ServerEvent } from '@shared/types.ts'

/** One EventSource for the whole app, mounted once at the root. Its only job
 * is invalidation — the 3s poll (see useSessions/useStats) is the actual data
 * refresh mechanism, so a dropped or missed SSE message just means "wait for
 * the next poll" rather than stale-forever state. Torn down while the tab is
 * hidden to avoid burning one of the browser's 6 per-origin connections. */
export function useLiveEvents(): void {
  const queryClient = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    function handle(event: ServerEvent) {
      switch (event.type) {
        case 'session:update':
          queryClient.invalidateQueries({ queryKey: ['session', event.sessionId] })
          queryClient.invalidateQueries({ queryKey: ['sessions'] })
          break
        case 'session:new':
          queryClient.invalidateQueries({ queryKey: ['sessions'] })
          queryClient.invalidateQueries({ queryKey: ['projects'] })
          break
        case 'stats:invalidate':
          queryClient.invalidateQueries({ queryKey: ['stats'] })
          break
        case 'pricing:updated':
          queryClient.invalidateQueries({ queryKey: ['stats'] })
          queryClient.invalidateQueries({ queryKey: ['settings'] })
          break
        default:
          break
      }
    }

    function connect() {
      const es = new EventSource('/api/events')
      sourceRef.current = es
      for (const type of ['hello', 'session:update', 'session:new', 'stats:invalidate', 'pricing:updated', 'index:progress'] as const) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            handle(JSON.parse(e.data) as ServerEvent)
          } catch {
            // malformed event payload — ignore, the next poll will catch up
          }
        })
      }
    }

    function disconnect() {
      sourceRef.current?.close()
      sourceRef.current = null
    }

    function onVisibilityChange() {
      if (document.hidden) disconnect()
      else if (!sourceRef.current) connect()
    }

    if (!document.hidden) connect()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      disconnect()
    }
  }, [queryClient])
}
