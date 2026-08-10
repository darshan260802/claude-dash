import { parseArgs } from 'node:util'

export interface CliOptions {
  port: number
  host: string
  claudeDirs: string[]
  open: boolean
  poll: boolean
  json: boolean
  help: boolean
  version: boolean
}

const DEFAULT_PORT = 4317
const DEFAULT_HOST = '127.0.0.1'

export function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: 'string' },
      host: { type: 'string' },
      'claude-dir': { type: 'string', multiple: true },
      'no-open': { type: 'boolean', default: false },
      poll: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false, short: 'h' },
      version: { type: 'boolean', default: false, short: 'v' },
    },
    allowPositionals: false,
    strict: true,
  })

  return {
    port: values.port ? Number(values.port) : DEFAULT_PORT,
    host: values.host ?? DEFAULT_HOST,
    claudeDirs: (values['claude-dir'] as string[] | undefined) ?? [],
    open: !values['no-open'],
    poll: Boolean(values.poll),
    json: Boolean(values.json),
    help: Boolean(values.help),
    version: Boolean(values.version),
  }
}

export interface Config extends CliOptions {
  /** The primary (first) resolved claude dir — for display/logging. */
  claudeDir: string
  /** Every resolved claude dir to index (multi-root when CLAUDE_CONFIG_DIR is
   * a path.delimiter-separated list) — distinct from CliOptions.claudeDirs,
   * which is just the raw --claude-dir flag values before resolution. */
  resolvedClaudeDirs: string[]
  detectedFrom: 'flag' | 'env' | 'default'
  liveWindowMs: number
  recentWindowMs: number
  pollIntervalMs: number
}

export const LIVE_WINDOW_MS = 60_000
export const RECENT_WINDOW_MS = 15 * 60_000
export const SWEEP_INTERVAL_MS = 10_000
