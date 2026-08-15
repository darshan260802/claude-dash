import { Link } from 'react-router'
import type { ShareItemDTO } from '@shared/types.ts'
import { Card, CardContent } from '@/components/ui/card'
import { LivenessPill } from '@/components/common/LivenessPill'
import { Robot, ChatsCircle } from '@phosphor-icons/react'

function pathFor(item: ShareItemDTO): string {
  return item.kind === 'agent' && item.agentId ? `/sessions/${item.sessionId}/agents/${item.agentId}` : `/sessions/${item.sessionId}`
}

/** Landing page for a visitor whose share has more than one item — a plain
 * list, nothing else. Single-item shares skip this entirely (ViewerIndexPage
 * redirects straight in). */
export function SharedItemSwitcher({ items }: { items: ShareItemDTO[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-heading text-lg font-semibold">Shared with you</h1>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Link key={`${item.sessionId}:${item.agentId ?? ''}`} to={pathFor(item)}>
            <Card className="gap-0 py-0 transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 p-4">
                {item.kind === 'agent' ? <Robot className="size-4 shrink-0 text-chart-5" /> : <ChatsCircle className="size-4 shrink-0 text-muted-foreground" />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.subtitle ? `${item.subtitle} · ` : ''}
                    {item.projectName}
                  </span>
                </div>
                <LivenessPill liveness={item.liveness} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
