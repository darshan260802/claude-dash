import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ViewerShell } from '@/components/layout/ViewerShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { ProjectDetailPage } from '@/pages/ProjectDetailPage'
import { SessionsPage } from '@/pages/SessionsPage'
import { SessionDetailPage } from '@/pages/SessionDetailPage'
import { AgentDetailPage } from '@/pages/AgentDetailPage'
import { LivePage } from '@/pages/LivePage'
import { SearchPage } from '@/pages/SearchPage'
import { SharePage } from '@/pages/SharePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AboutPage } from '@/pages/AboutPage'
import { ViewerIndexPage } from '@/pages/viewer/ViewerIndexPage'

/** The owner's full tree — also what a GLOBAL-mode share visitor gets
 * (see src/App.tsx's router selection): "share the whole dashboard" means
 * exactly that. AppSidebar hides Settings/Share from the nav for a
 * non-owner, and both pages redirect away if reached directly; the real
 * boundary is server-side (PATCH /api/settings and all of /api/share/* are
 * 403 for any non-owner, regardless of mode). */
export const ownerRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:projectKey', element: <ProjectDetailPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      { path: 'sessions/:sessionId', element: <SessionDetailPage /> },
      { path: 'sessions/:sessionId/agents/:agentId', element: <AgentDetailPage /> },
      { path: 'live', element: <LivePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'share', element: <SharePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'about', element: <AboutPage /> },
    ],
  },
])

/** A SCOPED-share visitor only — the smallest surface this app can serve:
 * no sidebar, no Projects/Stats/Settings/Share, just the shared session(s).
 * Security is enforced by the server's scopeGuard regardless of which
 * router the frontend happens to mount; this is a UX affordance on top of
 * that, not the boundary itself. */
export const viewerRouter = createBrowserRouter([
  {
    path: '/',
    element: <ViewerShell />,
    children: [
      { index: true, element: <ViewerIndexPage /> },
      { path: 'sessions/:sessionId', element: <SessionDetailPage /> },
      { path: 'sessions/:sessionId/agents/:agentId', element: <AgentDetailPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
