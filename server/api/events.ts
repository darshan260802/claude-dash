import type { ServerEvent } from '@shared/types.ts'

type Listener = (event: ServerEvent) => void

/** Simple in-process pub/sub — every open SSE connection subscribes and
 * receives every event. Traffic is invalidation-only (see boot.ts / Watcher):
 * the frontend's primary refresh is a 3s TanStack Query poll, so an SSE
 * message just triggers an immediate refetch rather than carrying the data
 * itself, meaning a missed or dropped message degrades gracefully to "wait
 * for the next poll" rather than "state goes stale forever". */
export class EventHub {
  private listeners = new Set<Listener>()

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  emit(event: ServerEvent): void {
    for (const l of this.listeners) l(event)
  }
}
