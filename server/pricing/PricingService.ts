import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ModelPrice, SettingsDTO } from '@shared/types.ts'
import { resolvePriceKey } from './cost.ts'
import { log } from '../util/log.ts'

const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 10_000
const RELEVANT_PROVIDERS = new Set(['anthropic', 'deepseek', 'openai', 'gemini', 'vertex_ai-anthropic_models', 'bedrock'])

interface CacheFile {
  fetchedAt: number
  data: Record<string, ModelPrice>
}

function cacheDir(): string {
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'claude-dash')
  }
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'claude-dash')
}

function cacheFilePath(): string {
  return join(cacheDir(), 'litellm-prices.json')
}

function filterRelevant(raw: Record<string, unknown>): Record<string, ModelPrice> {
  const out: Record<string, ModelPrice> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue
    const v = value as Record<string, unknown>
    if (typeof v.litellm_provider !== 'string' || !RELEVANT_PROVIDERS.has(v.litellm_provider)) continue
    if (typeof v.input_cost_per_token !== 'number') continue
    out[key] = {
      input_cost_per_token: v.input_cost_per_token as number | undefined,
      output_cost_per_token: v.output_cost_per_token as number | undefined,
      cache_creation_input_token_cost: v.cache_creation_input_token_cost as number | undefined,
      cache_creation_input_token_cost_above_1hr: v.cache_creation_input_token_cost_above_1hr as number | undefined,
      cache_read_input_token_cost: v.cache_read_input_token_cost as number | undefined,
    }
  }
  return out
}

export class PricingService {
  private prices: Record<string, ModelPrice> = {}
  private source: SettingsDTO['pricing']['source'] = 'fallback'
  private fetchedAt: number | null = null
  private lastError: string | undefined
  private unpriced = new Set<string>()
  private onUpdate?: () => void

  constructor(onUpdate?: () => void) {
    this.onUpdate = onUpdate
  }

  /** Loads the bundled fallback synchronously-ish (fast local read) so the
   * server can start pricing immediately, then kicks off a non-blocking live
   * refresh — pricing.init() itself never blocks server boot on network I/O. */
  async init(fallbackPath: string, opts: { skipRefresh?: boolean } = {}): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(fallbackPath, 'utf8')) as Record<string, ModelPrice>
      this.prices = raw
      this.source = 'fallback'
    } catch (err) {
      log.warn(`could not load bundled pricing fallback: ${String(err)}`)
    }

    // Try the on-disk cache (from a previous run) before firing a network
    // request — avoids re-fetching on every restart within 24h.
    try {
      const cached = JSON.parse(await readFile(cacheFilePath(), 'utf8')) as CacheFile
      if (Date.now() - cached.fetchedAt < REFRESH_INTERVAL_MS) {
        this.prices = cached.data
        this.source = 'cache'
        this.fetchedAt = cached.fetchedAt
      }
    } catch {
      // no cache yet, or unreadable — fine, we already have the fallback
    }

    // Fire-and-forget: never await this from init() / server boot.
    if (!opts.skipRefresh) void this.refresh()
  }

  async refresh(force = false): Promise<void> {
    if (!force && this.fetchedAt && Date.now() - this.fetchedAt < REFRESH_INTERVAL_MS) return
    try {
      const res = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = (await res.json()) as Record<string, unknown>
      const filtered = filterRelevant(raw)
      if (Object.keys(filtered).length === 0) throw new Error('empty pricing payload')

      this.prices = filtered
      this.source = 'live'
      this.fetchedAt = Date.now()
      this.lastError = undefined

      await mkdir(cacheDir(), { recursive: true })
      const cacheFile: CacheFile = { fetchedAt: this.fetchedAt, data: filtered }
      await writeFile(cacheFilePath(), JSON.stringify(cacheFile))

      this.onUpdate?.()
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err)
      log.warn(`pricing refresh failed, staying on ${this.source} prices: ${this.lastError}`)
    }
  }

  get(model: string): ModelPrice | null {
    const key = resolvePriceKey(model, (k) => k in this.prices)
    if (!key) {
      this.unpriced.add(model)
      return null
    }
    return this.prices[key]
  }

  get status(): SettingsDTO['pricing'] {
    return {
      source: this.source,
      fetchedAt: this.fetchedAt,
      modelCount: Object.keys(this.prices).length,
      unpricedModels: [...this.unpriced],
      error: this.lastError,
    }
  }
}
