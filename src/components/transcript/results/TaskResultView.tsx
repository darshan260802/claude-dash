import type { ToolResultDTO } from '@shared/types.ts'
import { Badge } from '@/components/ui/badge'

interface TaskRaw {
  success?: boolean
  statusChange?: string | { from?: string; to?: string }
  task?: { subject?: string; status?: string }
  updatedFields?: string[]
}

export function TaskResultView({ result }: { result: ToolResultDTO }) {
  const raw = result.raw as TaskRaw | undefined
  if (!raw) return null

  const statusChangeLabel =
    typeof raw.statusChange === 'string' ? raw.statusChange : raw.statusChange ? `${raw.statusChange.from ?? '?'} → ${raw.statusChange.to ?? '?'}` : undefined

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {raw.task?.subject && <span className="font-medium">{raw.task.subject}</span>}
      {statusChangeLabel && <Badge variant="outline">{statusChangeLabel}</Badge>}
      {raw.success === false && (
        <Badge variant="destructive" className="text-[10px]">
          failed
        </Badge>
      )}
    </div>
  )
}
