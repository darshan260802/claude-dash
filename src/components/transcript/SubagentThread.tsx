import { useSubagentTurns } from '@/hooks/useSessionTurns'
import { TurnRow } from './TurnRow'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function SubagentThread({ sessionId, agentId }: { sessionId: string; agentId: string }) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useSubagentTurns(sessionId, agentId, true)
  const turns = data?.pages.flatMap((p) => p.turns) ?? []

  return (
    <div className="ml-2 flex flex-col gap-3 border-l-2 border-primary/20 py-2 pl-4">
      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      )}
      {turns.map((turn, i) => (
        <TurnRow key={turn.id + i} turn={turn} session={sessionId} isSubagent />
      ))}
      {hasNextPage && (
        <Button variant="ghost" size="sm" className="self-start text-xs" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
