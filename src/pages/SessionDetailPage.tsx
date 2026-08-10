import { useParams } from 'react-router'
import { useSession } from '@/hooks/useSessions'
import { useSessionTurns } from '@/hooks/useSessionTurns'
import { useFilterParams } from '@/hooks/useFilterParams'
import { SessionHeader } from '@/components/sessions/SessionHeader'
import { SessionStatsRail } from '@/components/sessions/SessionStatsRail'
import { TranscriptToolbar } from '@/components/transcript/TranscriptToolbar'
import { TranscriptVirtualList } from '@/components/transcript/TranscriptVirtualList'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { Warning } from '@phosphor-icons/react'

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { data: session, isLoading: sessionLoading, isError } = useSession(sessionId)
  const { kinds, q, setKinds, setQuery } = useFilterParams()

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useSessionTurns(sessionId, session?.liveness, { kinds, q: q || undefined })
  const turns = data?.pages.flatMap((p) => p.turns) ?? []

  if (sessionLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (isError || !session) {
    return <EmptyState icon={Warning} title="Session not found" description="It may have been deleted, or the ID is wrong." />
  }

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader session={session} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <TranscriptToolbar kinds={kinds} onKindsChange={setKinds} q={q} onQueryChange={setQuery} />
          <TranscriptVirtualList
            turns={turns}
            session={session.id}
            isLoading={isLoading}
            hasNextPage={hasNextPage}
            onLoadMore={fetchNextPage}
            isFetchingNextPage={isFetchingNextPage}
            autoScroll={session.liveness !== 'ended'}
          />
        </div>
        <div className="hidden lg:block">
          <SessionStatsRail session={session} />
        </div>
      </div>
    </div>
  )
}
