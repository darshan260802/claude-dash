import { Link } from 'react-router'
import { ShareNetwork } from '@phosphor-icons/react'
import { useShareContext, useShareStatus } from '@/hooks/useShare'

/** Owner-only reminder in the top bar that a share is running — easy to
 * forget once the tab that started it is closed. Renders nothing while
 * idle, for a visitor, or before the ownership check resolves. */
export function ShareStatusBanner() {
  const { data: ctx } = useShareContext()
  const { data: status } = useShareStatus()

  if (ctx?.isOwner !== true || !status || status.state === 'idle') return null

  const label =
    status.state === 'starting'
      ? 'Starting share…'
      : status.mode === 'global'
        ? 'Sharing whole dashboard'
        : `Sharing ${status.items.length} item${status.items.length === 1 ? '' : 's'}`

  return (
    <Link
      to="/share"
      className="flex items-center gap-1.5 rounded-full border border-chart-2/30 bg-chart-2/10 px-2.5 py-1 text-xs font-medium text-chart-2 transition-colors hover:bg-chart-2/15"
    >
      <ShareNetwork className="size-3.5" />
      {label}
    </Link>
  )
}
