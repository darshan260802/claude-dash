import { Navigate } from 'react-router'
import { ShareNetwork } from '@phosphor-icons/react'
import { useShareContext } from '@/hooks/useShare'
import { SharedItemSwitcher } from '@/components/layout/SharedItemSwitcher'
import { EmptyState } from '@/components/common/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import type { ShareItemDTO } from '@shared/types.ts'

function pathFor(item: ShareItemDTO): string {
  return item.kind === 'agent' && item.agentId ? `/sessions/${item.sessionId}/agents/${item.agentId}` : `/sessions/${item.sessionId}`
}

/** The scoped visitor's landing page — one item redirects straight in,
 * several show the switcher, none shows an empty state (the owner emptied
 * the scope but left the tunnel up). Deliberately no server-side redirect
 * for "/" itself: the gate always answers any path with 200 HTML and a
 * server redirect would fight the SPA's own history handling. */
export function ViewerIndexPage() {
  const { data: ctx, isLoading } = useShareContext()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (!ctx || !ctx.active || ctx.items.length === 0) {
    return <EmptyState icon={ShareNetwork} title="Nothing is shared right now" description="Ask whoever sent you this link to share a session again." />
  }

  if (ctx.items.length === 1) {
    return <Navigate to={pathFor(ctx.items[0]!)} replace />
  }

  return <SharedItemSwitcher items={ctx.items} />
}
