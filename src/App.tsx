import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/queryClient'
import { ownerRouter, viewerRouter } from '@/routes'
import { useShareContext } from '@/hooks/useShare'

/** Picks the owner's full router or the stripped scoped-visitor router,
 * based on GET /api/shared — the one endpoint every viewer (owner or
 * visitor, any mode) can always reach. A global-mode visitor gets the
 * owner's router too (see routes.tsx's doc comment); only a scoped-share
 * visitor gets the minimal one. While the query is still pending, render
 * nothing — the static splash screen in index.html covers this window on
 * every load, so there's nothing to flash here. */
function RouterSelector() {
  const { data: ctx, isPending } = useShareContext()
  if (isPending) return null
  const isScopedVisitor = ctx != null && ctx.isOwner === false && ctx.mode === 'scoped'
  return <RouterProvider router={isScopedVisitor ? viewerRouter : ownerRouter} />
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterSelector />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
