import { useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { TurnDTO } from '@shared/types.ts'
import { TurnRow } from './TurnRow'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ChatsCircle } from '@phosphor-icons/react'

export function TranscriptVirtualList({
  turns,
  session,
  isLoading,
  hasNextPage,
  onLoadMore,
  isFetchingNextPage,
  autoScroll,
}: {
  turns: TurnDTO[]
  session: string
  isLoading: boolean
  hasNextPage: boolean
  onLoadMore: () => void
  isFetchingNextPage: boolean
  autoScroll?: boolean
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const wasAtBottomRef = useRef(true)

  const virtualizer = useVirtualizer({
    count: turns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 8,
    // NOT turn.id — a resumed/replayed turn legitimately shares its id with
    // an earlier turn in the same array (see groupIntoTurns / turns.test.ts),
    // and a duplicate key here corrupts react-virtual's DOM reuse (observed:
    // ghost overlapping rows). byteOffset is unique per turn by construction.
    getItemKey: (index) => turns[index]?.byteOffset ?? index,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index

  // Trigger loading the next page (older→newer isn't reversed here — turns
  // arrive oldest-first, so "next page" is scrolling further down) shortly
  // before the bottom is reached. Depends on the primitive last-visible-index
  // rather than the getVirtualItems() array itself, which is a new reference
  // every render and would otherwise re-fire this effect constantly.
  useEffect(() => {
    if (lastVisibleIndex != null && lastVisibleIndex >= turns.length - 5 && hasNextPage && !isFetchingNextPage) {
      onLoadMore()
    }
  }, [lastVisibleIndex, turns.length, hasNextPage, isFetchingNextPage, onLoadMore])

  // Auto-scroll to bottom on new turns for a live session, but only if the
  // user was already at (or near) the bottom — never yank them away from
  // where they're reading.
  useEffect(() => {
    if (!autoScroll) return
    const el = parentRef.current
    if (!el) return
    if (wasAtBottomRef.current) {
      virtualizer.scrollToIndex(turns.length - 1, { align: 'end' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length, autoScroll])

  function handleScroll() {
    const el = parentRef.current
    if (!el) return
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (turns.length === 0) {
    return <EmptyState icon={ChatsCircle} title="No messages match these filters" />
  }

  return (
    <div ref={parentRef} onScroll={handleScroll} className="h-[calc(100vh-14rem)] overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map((vItem) => (
          <div
            key={vItem.key}
            data-index={vItem.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vItem.start}px)` }}
            className="pb-3"
          >
            <TurnRow turn={turns[vItem.index]} session={session} />
          </div>
        ))}
      </div>
    </div>
  )
}
