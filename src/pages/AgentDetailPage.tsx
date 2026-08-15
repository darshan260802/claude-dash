import { useParams } from 'react-router'
import { useSubagentDetail, useSubagentTurns } from '@/hooks/useSessionTurns'
import { AgentHeader } from '@/components/sessions/AgentHeader'
import { TranscriptVirtualList } from '@/components/transcript/TranscriptVirtualList'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { Warning } from '@phosphor-icons/react'

export function AgentDetailPage() {
  const { sessionId, agentId } = useParams<{ sessionId: string; agentId: string }>()
  const { data: detail, isLoading: detailLoading, isError } = useSubagentDetail(sessionId, agentId)
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useSubagentTurns(sessionId, agentId, true, detail?.liveness)
  const turns = data?.pages.flatMap((p) => p.turns) ?? []

  if (detailLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !detail) {
    return <EmptyState icon={Warning} title="Agent transcript not found" description="It may have been deleted, or the link is wrong." />
  }

  return (
    <div className="flex flex-col gap-4">
      <AgentHeader detail={detail} />
      <TranscriptVirtualList
        turns={turns}
        session={sessionId!}
        isLoading={isLoading}
        hasNextPage={hasNextPage}
        onLoadMore={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
        autoScroll={detail.liveness !== 'ended'}
      />
    </div>
  )
}
