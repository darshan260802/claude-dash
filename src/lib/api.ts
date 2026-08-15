import type {
  ProjectSummaryDTO,
  SessionSummaryDTO,
  SessionDetailDTO,
  SubagentDetailDTO,
  TurnsPageDTO,
  StatsDTO,
  SearchResultDTO,
  SettingsDTO,
  SettingsPatchDTO,
  TurnKind,
  ShareContextDTO,
  ShareStatusDTO,
  ShareMode,
} from '@shared/types.ts'

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>, init?: RequestInit): Promise<T> {
  const qs = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v))
    }
  }
  const query = qs.toString()
  const res = await fetch(query ? `${path}?${query}` : path, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  return res.json() as Promise<T>
}

/** The CSRF half of owner-only enforcement (see server/share/middleware.ts's
 * isSameOriginRequest) — a custom header forces a CORS preflight this server
 * never answers, so a page loaded from anywhere else can't attach it even
 * via a same-site fetch to this loopback origin. Sent on every /api/share/*
 * call, GET included, since that whole prefix requires it. */
const OWNER_HEADERS = { 'X-Claude-Dash': '1' }

interface ApiError extends Error {
  status?: number
  body?: unknown
}

async function postOwner<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...OWNER_HEADERS },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const err: ApiError = new Error(`${res.status} ${res.statusText} — ${path}`)
    err.status = res.status
    err.body = errBody
    throw err
  }
  return res.json() as Promise<T>
}

export interface SessionFilters {
  project?: string
  live?: boolean
  model?: string
  from?: string
  to?: string
  limit?: number
  cursor?: number
}

export const api = {
  health: () => get<{ ok: true; version: string; indexed: { projects: number; sessions: number; turns: number }; indexing: boolean }>('/api/health'),

  projects: () => get<{ projects: ProjectSummaryDTO[] }>('/api/projects').then((r) => r.projects),
  project: (key: string) => get<ProjectSummaryDTO>(`/api/projects/${encodeURIComponent(key)}`),

  sessions: (filters: SessionFilters = {}) =>
    get<{ sessions: SessionSummaryDTO[]; nextCursor: number | null; total: number }>('/api/sessions', filters as Record<string, string | number | boolean | undefined>),
  session: (id: string) => get<SessionDetailDTO>(`/api/sessions/${encodeURIComponent(id)}`),

  sessionTurns: (id: string, opts: { cursor?: number; limit?: number; kinds?: TurnKind[]; tools?: string[]; q?: string } = {}) =>
    get<TurnsPageDTO>(`/api/sessions/${encodeURIComponent(id)}/turns`, {
      cursor: opts.cursor,
      limit: opts.limit,
      kinds: opts.kinds?.join(','),
      tools: opts.tools?.join(','),
      q: opts.q,
    }),

  subagent: (sessionId: string, agentId: string) =>
    get<SubagentDetailDTO>(`/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}`),
  subagentTurns: (sessionId: string, agentId: string, opts: { cursor?: number; limit?: number } = {}) =>
    get<TurnsPageDTO>(`/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}/turns`, opts),

  stats: (opts: { from?: string; to?: string; project?: string; groupBy?: 'day' | 'hour' | 'model' | 'project' | 'tool' } = {}) =>
    get<StatsDTO>('/api/stats', opts),

  search: (opts: { q: string; project?: string; kinds?: TurnKind[]; limit?: number }) =>
    get<SearchResultDTO>('/api/search', { q: opts.q, project: opts.project, kinds: opts.kinds?.join(','), limit: opts.limit }),

  settings: () => get<SettingsDTO>('/api/settings'),
  patchSettings: async (patch: SettingsPatchDTO) => {
    const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json() as Promise<{ ok: true }>
  },

  // Sharing. shareContext is the one endpoint every viewer (owner or
  // visitor, any mode) can reach — it's what the app uses to decide which
  // router/shell to render. Everything else here is owner-only.
  shareContext: () => get<ShareContextDTO>('/api/shared'),
  shareStatus: () => get<ShareStatusDTO>('/api/share', undefined, { headers: OWNER_HEADERS }),
  startShare: (mode: ShareMode) => postOwner<ShareStatusDTO | { state: 'starting' }>('/api/share/start', { mode }),
  stopShare: () => postOwner<ShareStatusDTO>('/api/share/stop'),
  addToShare: (item: { sessionId: string; agentId?: string; replaceGlobal?: boolean }) =>
    postOwner<ShareStatusDTO | { state: 'starting' }>('/api/share/scope/add', item),
  removeFromShare: (item: { sessionId: string; agentId?: string }) => postOwner<ShareStatusDTO>('/api/share/scope/remove', item),

  rawBlockUrl: (session: string, byteOffset: number, byteLength: number, agentId?: string) =>
    `/api/raw/block?session=${encodeURIComponent(session)}&byteOffset=${byteOffset}&byteLength=${byteLength}${agentId ? `&agent=${encodeURIComponent(agentId)}` : ''}`,
  rawOverflowUrl: (session: string, name: string) => `/api/raw/overflow?session=${encodeURIComponent(session)}&name=${encodeURIComponent(name)}`,
  rawAttachmentUrl: (session: string, byteOffset: number, byteLength: number, agentId?: string) =>
    `/api/raw/attachment?session=${encodeURIComponent(session)}&byteOffset=${byteOffset}&byteLength=${byteLength}${agentId ? `&agent=${encodeURIComponent(agentId)}` : ''}`,
}
