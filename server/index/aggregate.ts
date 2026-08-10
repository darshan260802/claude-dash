import type { StatsDTO, StatsSeriesPoint, StatsByModel, StatsByProject, StatsByTool, TurnDTO, UsageTotals } from '@shared/types.ts'
import { emptyTotals, addUsageToTotals } from '../claude/usage.ts'

export interface StatsSessionInput {
  sessionId: string
  projectKey: string
  projectName: string
  turns: TurnDTO[]
}

export interface StatsOptions {
  from?: string
  to?: string
  project?: string
  groupBy: 'day' | 'hour' | 'model' | 'project' | 'tool'
}

function bucketKey(iso: string, groupBy: 'day' | 'hour'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  if (groupBy === 'hour') return d.toISOString().slice(0, 13) + ':00'
  return d.toISOString().slice(0, 10)
}

interface SeriesAccum {
  totals: UsageTotals
  cost: number
  apiCalls: number
  sessions: Set<string>
}

function newSeriesAccum(): SeriesAccum {
  return { totals: emptyTotals(), cost: 0, apiCalls: 0, sessions: new Set() }
}

export function computeStats(inputs: StatsSessionInput[], opts: StatsOptions): StatsDTO {
  const fromTs = opts.from ? Date.parse(opts.from) : -Infinity
  const toTs = opts.to ? Date.parse(opts.to) : Infinity

  const totals = emptyTotals()
  let totalCost = 0
  let apiCalls = 0
  let unpricedCalls = 0
  const sessionsSeen = new Set<string>()
  const projectsSeen = new Set<string>()

  const seriesMap = new Map<string, SeriesAccum>()
  const byModel = new Map<string, { calls: number; cost: number; input: number; output: number; cacheRead: number }>()
  const byProject = new Map<string, { projectName: string; calls: number; cost: number; input: number; output: number }>()
  const byTool = new Map<string, { calls: number; errors: number; mcpServer?: string }>()

  const groupByBucket = opts.groupBy === 'day' || opts.groupBy === 'hour'

  for (const input of inputs) {
    if (opts.project && input.projectKey !== opts.project) continue

    for (const turn of input.turns) {
      const ts = turn.timestamp ? Date.parse(turn.timestamp) : NaN
      const inRange = Number.isNaN(ts) || (ts >= fromTs && ts <= toTs)

      if (turn.kind === 'assistant' && turn.usageCounted) {
        if (!inRange) continue
        apiCalls++
        sessionsSeen.add(input.sessionId)
        projectsSeen.add(input.projectKey)
        addUsageToTotals(totals, turn.usage)
        if (turn.cost == null) unpricedCalls++
        else totalCost += turn.cost

        if (groupByBucket && turn.timestamp) {
          const key = bucketKey(turn.timestamp, opts.groupBy as 'day' | 'hour')
          const acc = seriesMap.get(key) ?? newSeriesAccum()
          addUsageToTotals(acc.totals, turn.usage)
          acc.cost += turn.cost ?? 0
          acc.apiCalls++
          acc.sessions.add(input.sessionId)
          seriesMap.set(key, acc)
        }

        if (turn.model) {
          const m = byModel.get(turn.model) ?? { calls: 0, cost: 0, input: 0, output: 0, cacheRead: 0 }
          m.calls++
          m.cost += turn.cost ?? 0
          m.input += turn.usage?.input_tokens ?? 0
          m.output += turn.usage?.output_tokens ?? 0
          m.cacheRead += turn.usage?.cache_read_input_tokens ?? 0
          byModel.set(turn.model, m)
        }

        const p = byProject.get(input.projectKey) ?? { projectName: input.projectName, calls: 0, cost: 0, input: 0, output: 0 }
        p.calls++
        p.cost += turn.cost ?? 0
        p.input += turn.usage?.input_tokens ?? 0
        p.output += turn.usage?.output_tokens ?? 0
        byProject.set(input.projectKey, p)
      }

      if (!inRange) continue
      for (const block of turn.blocks) {
        if (block.type !== 'tool_use') continue
        const t = byTool.get(block.name) ?? { calls: 0, errors: 0, mcpServer: block.mcpServer }
        t.calls++
        if (block.result?.isError) t.errors++
        byTool.set(block.name, t)
      }
    }
  }

  const series: StatsSeriesPoint[] = [...seriesMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([bucket, acc]) => ({
      bucket,
      input: acc.totals.input,
      output: acc.totals.output,
      cacheRead: acc.totals.cacheRead,
      cacheWrite5m: acc.totals.cacheWrite5m,
      cacheWrite1h: acc.totals.cacheWrite1h,
      cost: acc.cost,
      apiCalls: acc.apiCalls,
      sessions: acc.sessions.size,
    }))

  const byModelArr: StatsByModel[] = [...byModel.entries()]
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.cost - a.cost)

  const byProjectArr: StatsByProject[] = [...byProject.entries()]
    .map(([projectKey, v]) => ({ projectKey, ...v }))
    .sort((a, b) => b.cost - a.cost)

  const byToolArr: StatsByTool[] = [...byTool.entries()]
    .map(([tool, v]) => ({ tool, ...v }))
    .sort((a, b) => b.calls - a.calls)

  return {
    range: { from: opts.from ?? '', to: opts.to ?? '' },
    totals: { ...totals, cost: totalCost, apiCalls, sessions: sessionsSeen.size, projects: projectsSeen.size, unpricedCalls },
    series,
    byModel: byModelArr,
    byProject: byProjectArr,
    byTool: byToolArr,
  }
}
