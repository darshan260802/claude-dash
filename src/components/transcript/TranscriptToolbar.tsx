import { useState, useEffect } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { TurnKind } from '@shared/types.ts'
import { Input } from '@/components/ui/input'
import { MessageFilterBar } from './MessageFilterBar'

export function TranscriptToolbar({
  kinds,
  onKindsChange,
  q,
  onQueryChange,
}: {
  kinds: TurnKind[]
  onKindsChange: (kinds: TurnKind[]) => void
  q: string
  onQueryChange: (q: string) => void
}) {
  const [local, setLocal] = useState(q)

  useEffect(() => setLocal(q), [q])

  useEffect(() => {
    const id = setTimeout(() => {
      if (local !== q) onQueryChange(local)
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-border bg-background/95 py-2.5 backdrop-blur">
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Search in this session…" className="h-8 pl-8 text-xs" />
      </div>
      <MessageFilterBar kinds={kinds} onChange={onKindsChange} />
    </div>
  )
}
