import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FolderOpen, ChatsCircle, SquaresFour, Broadcast, Gear } from '@phosphor-icons/react'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { useSearch } from '@/hooks/useSearch'
import { relativeTime } from '@shared/format.ts'

const STATIC_COMMANDS = [
  { to: '/', label: 'Dashboard', icon: SquaresFour },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/sessions', label: 'Sessions', icon: ChatsCircle },
  { to: '/live', label: 'Live sessions', icon: Broadcast },
  { to: '/settings', label: 'Settings', icon: Gear },
]

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { data } = useSearch({ q: query, limit: 8 })
  const setOpen = onOpenChange

  function go(to: string) {
    setOpen(false)
    setQuery('')
    navigate(to)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Jump to a page or search your sessions">
      <CommandInput placeholder="Search sessions, or jump to a page…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {!query && (
          <CommandGroup heading="Pages">
            {STATIC_COMMANDS.map((c) => (
              <CommandItem key={c.to} value={c.label} onSelect={() => go(c.to)}>
                <c.icon />
                <span>{c.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {query && data && data.hits.length > 0 && (
          <CommandGroup heading="Messages">
            {data.hits.map((hit) => (
              <CommandItem key={`${hit.sessionId}:${hit.turnId}`} value={`${hit.sessionTitle} ${hit.snippet}`} onSelect={() => go(`/sessions/${hit.sessionId}`)}>
                <ChatsCircle />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{hit.sessionTitle}</span>
                  <span className="truncate text-xs text-muted-foreground">{hit.snippet}</span>
                </div>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{relativeTime(hit.timestamp)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
