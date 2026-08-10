import { useState } from 'react'
import { useSessions } from '@/hooks/useSessions'
import { SessionTable } from '@/components/sessions/SessionTable'
import { SessionFilters, type SessionFilterState } from '@/components/sessions/SessionFilters'
import { Skeleton } from '@/components/ui/skeleton'

export function SessionsPage() {
  const [filters, setFilters] = useState<SessionFilterState>({ liveOnly: false })
  const { data, isLoading } = useSessions({
    project: filters.project,
    model: filters.model,
    live: filters.liveOnly || undefined,
    from: filters.from,
    to: filters.to,
    limit: 200,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Sessions</h1>
        <p className="text-sm text-muted-foreground">Every recorded Claude Code session, past and present.</p>
      </div>

      <SessionFilters value={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{data?.total ?? 0} sessions</p>
          <SessionTable sessions={data?.sessions ?? []} />
        </>
      )}
    </div>
  )
}
