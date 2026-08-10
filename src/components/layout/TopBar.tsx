import { MagnifyingGlass } from '@phosphor-icons/react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { LiveIndicator } from './LiveIndicator'
import { ThemeToggle } from './ThemeToggle'

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <Button
        variant="outline"
        className="ml-1 h-8 w-64 justify-start gap-2 px-3 text-muted-foreground"
        onClick={onOpenPalette}
      >
        <MagnifyingGlass className="size-3.5" />
        <span className="text-xs">Search sessions…</span>
        <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
      </Button>
      <div className="ml-auto flex items-center gap-3">
        <LiveIndicator />
        <ThemeToggle />
      </div>
    </header>
  )
}
