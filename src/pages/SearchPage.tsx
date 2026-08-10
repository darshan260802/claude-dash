import { useState } from 'react'
import { Link } from 'react-router'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useSearch } from '@/hooks/useSearch'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/common/EmptyState'
import { RelativeTime } from '@/components/common/RelativeTime'
import { Badge } from '@/components/ui/badge'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const { data, isFetching } = useSearch({ q: query, limit: 100 })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">Search across every message in every session.</p>
      </div>

      <div className="relative max-w-lg">
        <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages, commands, file paths…" className="h-10 pl-9" autoFocus />
      </div>

      {query.trim() && !isFetching && data && (
        <p className="text-xs text-muted-foreground">
          {data.total} result{data.total === 1 ? '' : 's'} in {data.tookMs.toFixed(1)}ms
        </p>
      )}

      {query.trim() && data && data.hits.length === 0 && !isFetching && <EmptyState icon={MagnifyingGlass} title="No results" />}

      <div className="flex flex-col gap-2">
        {data?.hits.map((hit) => (
          <Link
            key={`${hit.sessionId}:${hit.turnId}`}
            to={`/sessions/${hit.sessionId}`}
            className="flex flex-col gap-1 rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{hit.sessionTitle}</span>
              <RelativeTime iso={hit.timestamp} className="shrink-0 text-[11px] text-muted-foreground" />
            </div>
            <p className="truncate text-xs text-muted-foreground">{hit.snippet}</p>
            <Badge variant="outline" className="w-fit text-[10px]">
              {hit.kind}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}
