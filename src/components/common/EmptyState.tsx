import type { ReactNode } from 'react'
import type { Icon } from '@phosphor-icons/react'

export function EmptyState({ icon: IconCmp, title, description, action }: { icon?: Icon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
      {IconCmp && <IconCmp className="mb-1 size-8 text-muted-foreground/50" />}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
