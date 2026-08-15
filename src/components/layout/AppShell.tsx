import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { TopBar } from './TopBar'
import { CommandPalette } from './CommandPalette'
import { useLiveEvents } from '@/hooks/useLiveEvents'
import { useShareContext } from '@/hooks/useShare'

export function AppShell() {
  const { data: shareCtx } = useShareContext()
  // Reached both by the owner and by a global-mode share visitor (see
  // src/App.tsx's router selection) — undefined while shareCtx is still
  // loading defaults to "owner", matching AppSidebar's own nav-filter logic,
  // so the common local-use case never flashes anything and then hides it.
  const isOwner = shareCtx?.isOwner !== false
  useLiveEvents(isOwner)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-6">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  )
}
