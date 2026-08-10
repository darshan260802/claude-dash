import type {
  ProjectSummaryDTO,
  SessionSummaryDTO,
  SessionDetailDTO,
  TurnsPageDTO,
  StatsDTO,
  SearchResultDTO,
  SettingsDTO,
  SettingsPatchDTO,
  TurnKind,
} from '@shared/types.ts'

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v))
    }
  }
  const query = qs.toString()
  const res = await fetch(query ? `${path}?${query}` : path)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
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

  rawBlockUrl: (session: string, byteOffset: number, byteLength: number) =>
    `/api/raw/block?session=${encodeURIComponent(session)}&byteOffset=${byteOffset}&byteLength=${byteLength}`,
  rawOverflowUrl: (session: string, name: string) => `/api/raw/overflow?session=${encodeURIComponent(session)}&name=${encodeURIComponent(name)}`,
  rawAttachmentUrl: (session: string, byteOffset: number, byteLength: number) =>
    `/api/raw/attachment?session=${encodeURIComponent(session)}&byteOffset=${byteOffset}&byteLength=${byteLength}`,
}
