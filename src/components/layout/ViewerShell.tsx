import { Outlet, Link } from 'react-router'
import { ThemeToggle } from './ThemeToggle'

/** The scoped-share visitor's shell — no sidebar, no command palette, no
 * useLiveEvents() (SSE is 403'd for every visitor server-side anyway; see
 * scopeGuard). A global-mode visitor never reaches this — they get the full
 * AppShell instead, since "share the whole dashboard" means exactly that
 * (see src/App.tsx's router selection). */
export function ViewerShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-heading text-sm font-bold">CD</div>
          <span className="font-heading text-sm font-semibold">Claude Dash</span>
        </Link>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Shared view</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
