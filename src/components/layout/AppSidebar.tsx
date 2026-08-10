import { Link, useLocation } from 'react-router'
import { SquaresFour, FolderOpen, ChatsCircle, Broadcast, MagnifyingGlass, Gear } from '@phosphor-icons/react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { LiveIndicator } from './LiveIndicator'

const NAV = [
  { to: '/', label: 'Dashboard', icon: SquaresFour, end: true },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/sessions', label: 'Sessions', icon: ChatsCircle },
  { to: '/live', label: 'Live', icon: Broadcast },
  { to: '/search', label: 'Search', icon: MagnifyingGlass },
  { to: '/settings', label: 'Settings', icon: Gear },
]

export function AppSidebar() {
  const location = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-heading text-sm font-bold">C</div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-heading text-sm font-semibold">claude-dash</span>
            <span className="text-[11px] text-muted-foreground">usage monitor</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
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
    </Sidebar>
  )
}
