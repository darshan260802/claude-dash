import { Link, useLocation } from 'react-router'
import { SquaresFour, FolderOpen, ChatsCircle, Broadcast, MagnifyingGlass, Gear, Info, ShareNetwork } from '@phosphor-icons/react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { LiveIndicator } from './LiveIndicator'
import { useShareContext } from '@/hooks/useShare'

const NAV = [
  { to: '/', label: 'Dashboard', icon: SquaresFour, end: true },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/sessions', label: 'Sessions', icon: ChatsCircle },
  { to: '/live', label: 'Live', icon: Broadcast },
  { to: '/search', label: 'Search', icon: MagnifyingGlass },
  // Both ownerOnly: reachable at all only because a global-mode share
  // visitor gets the same route tree as the owner (see App.tsx) — these two
  // are the owner's own control surface within it, and the server 403s them
  // for a visitor independently of this filter (PATCH /api/settings and all
  // of /api/share/* are owner-only regardless of mode).
  { to: '/share', label: 'Share', icon: ShareNetwork, ownerOnly: true },
  { to: '/settings', label: 'Settings', icon: Gear, ownerOnly: true },
]

export function AppSidebar() {
  const location = useLocation()
  const { data: shareCtx } = useShareContext()
  // undefined (still loading) counts as owner — avoids a flash of these
  // items appearing then disappearing for the overwhelmingly common local
  // (non-shared) case.
  const isOwner = shareCtx?.isOwner !== false

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-heading text-sm font-bold">CD</div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-heading text-sm font-semibold">Claude Dash</span>
            <span className="text-[11px] text-muted-foreground">Usage Monitor</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.filter((item) => !item.ownerOnly || isOwner).map((item) => {
                const isActive = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton isActive={isActive} tooltip={item.label} render={<Link to={item.to} />}>
                      <item.icon weight={isActive ? 'fill' : 'regular'} />
                      <span>{item.label}</span>
                      {item.to === '/live' && <LiveIndicator variant="dot" />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={location.pathname === '/about'} tooltip="About" render={<Link to="/about" />}>
              <Info weight={location.pathname === '/about' ? 'fill' : 'regular'} />
              <span>About</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
