import { serve } from '@hono/node-server'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './api/app.ts'
import { EventHub } from './api/events.ts'
import { resolveClaudeDirs } from './claude/paths.ts'
import { SessionIndex } from './index/SessionIndex.ts'
import { buildIndex } from './index/Indexer.ts'
import { startWatcher, type WatcherHandle } from './index/Watcher.ts'
import { PricingService } from './pricing/PricingService.ts'
import type { Config, CliOptions } from './config.ts'
import { LIVE_WINDOW_MS, RECENT_WINDOW_MS } from './config.ts'
import { log } from './util/log.ts'

const PKG_VERSION = '0.1.0'

const here = fileURLToPath(new URL('.', import.meta.url))
// dist-server/index.js -> ../dist-web ; server/boot.ts (dev, via tsx) -> ../dist-web
const WEB_DIR = resolve(here, '..', 'dist-web')
const FALLBACK_PRICING_PATH = resolve(here, 'pricing', 'fallback.json')

const MAX_PORT_ATTEMPTS = 20

/** Binds to `startPort`, retrying on the next port up if it's already taken
 * (a previous claude-dash instance, or anything else). Any other listen
 * error (e.g. EACCES) is thrown immediately rather than retried. */
async function listenWithPortFallback(fetch: Parameters<typeof serve>[0]['fetch'], hostname: string, startPort: number): Promise<{ server: ReturnType<typeof serve>; port: number }> {
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const port = startPort + attempt
    try {
      const server = await new Promise<ReturnType<typeof serve>>((resolvePromise, reject) => {
        const s = serve({ fetch, port, hostname }, (info) => resolvePromise(Object.assign(s, { info })))
        s.on('error', reject)
      })
      if (attempt > 0) log.warn(`port ${startPort} was already in use — listening on ${port} instead`)
      return { server, port }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code !== 'EADDRINUSE' || attempt === MAX_PORT_ATTEMPTS - 1) throw err
    }
  }
  throw new Error('unreachable')
}

export interface BootResult {
  close: () => Promise<void>
  url: string
  config: Config
  index: SessionIndex
}

export function buildConfig(cli: CliOptions): Config {
  const { dirs, detectedFrom } = resolveClaudeDirs(cli.claudeDirs)
  return {
    ...cli,
    claudeDir: dirs[0],
    resolvedClaudeDirs: dirs,
    detectedFrom,
    liveWindowMs: LIVE_WINDOW_MS,
    recentWindowMs: RECENT_WINDOW_MS,
    pollIntervalMs: 3000,
  }
}

export async function boot(cli: CliOptions): Promise<BootResult> {
  const config = buildConfig(cli)
  log.info(`claude dir: ${config.resolvedClaudeDirs.join(', ')} (via ${config.detectedFrom})`)

  const pricing = new PricingService(() => hub.emit({ type: 'pricing:updated' }))
  await pricing.init(FALLBACK_PRICING_PATH)

  const index = new SessionIndex(pricing)
  const hub = new EventHub()

  await buildIndex(index, config.resolvedClaudeDirs)

  // --json is a headless one-shot: print the index summary and exit, so
  // there's no reason to start the file watcher or bind a network listener
  // (and every reason not to bind — it'd needlessly fail with EADDRINUSE
  // next to a real running instance).
  if (cli.json) {
    return { url: '', config, index, close: async () => {} }
  }

  let watcher: WatcherHandle | null = null
  try {
    watcher = startWatcher(index, config.resolvedClaudeDirs, {
      poll: config.poll,
      onUpdate: ({ sessionId, projectKey, newTurns, isNew }) => {
        const session = index.getSession(sessionId)
        if (isNew) hub.emit({ type: 'session:new', sessionId, projectKey })
        if (session) {
          hub.emit({
            type: 'session:update',
            sessionId,
            projectKey,
            liveness: session.liveness,
            turnCount: session.turnCount,
            totals: session.totals,
            cost: session.cost,
            newTurns,
          })
        }
        hub.emit({ type: 'stats:invalidate' })
      },
    })
  } catch (err) {
    log.warn(`file watcher failed to start (live updates disabled): ${String(err)}`)
  }

  const app = createApp({
    webDir: WEB_DIR,
    ctx: { index, pricing, hub, config, version: PKG_VERSION },
    getHealth: () => ({
      ok: true,
      version: PKG_VERSION,
      indexed: index.counts,
      indexing: false,
    }),
  })

  const { server, port } = await listenWithPortFallback(app.fetch, config.host, config.port)

  const url = `http://${config.host}:${port}`

  return {
    url,
    config,
    index,
    close: async () => {
      await watcher?.close()
      await new Promise<void>((res) => server.close(() => res()))
    },
  }
}
