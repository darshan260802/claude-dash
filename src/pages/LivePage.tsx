import { useSessions } from '@/hooks/useSessions'
import { SessionCard } from '@/components/sessions/SessionCard'
import { EmptyState } from '@/components/common/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Broadcast } from '@phosphor-icons/react'

export function LivePage() {
  const { data, isLoading } = useSessions({ live: true })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Live</h1>
        <p className="text-sm text-muted-foreground">Sessions with recent activity — inferred from file activity, not an exact "running" signal.</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.sessions.length === 0) && (
        <EmptyState icon={Broadcast} title="Nothing live right now" description="Start a Claude Code session and it'll show up here within a few seconds." />
      )}

      {data && data.sessions.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  )
}
