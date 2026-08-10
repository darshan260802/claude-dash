import { parseCliArgs } from './config.ts'
import { boot } from './boot.ts'
import { openBrowser } from './util/openBrowser.ts'
import { log } from './util/log.ts'
import { formatCost } from '@shared/format.ts'

const MIN_NODE_MAJOR = 20
const MIN_NODE_MINOR = 19

function checkNodeVersion(): void {
  const [major, minor] = process.versions.node.split('.').map(Number)
  const ok = major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)
  if (!ok) {
    console.error(
      `claude-dash requires Node >=${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 (found ${process.versions.node}). Please upgrade Node and try again.`,
    )
    process.exit(1)
  }
}

export async function main(argv: string[]): Promise<void> {
  const cli = parseCliArgs(argv)

  if (cli.help) {
    console.log(`claude-dash — local Claude Code usage monitor

Usage: claude-dash [options]

  --port <n>          Port to listen on (default 4317)
  --host <s>           Host to bind (default 127.0.0.1)
  --claude-dir <path>  Override ~/.claude location (repeatable)
  --no-open             Don't open the browser automatically
  --poll                 Use polling for file watching (WSL/NFS/Docker)
  --json                 Print index summary as JSON and exit
  -h, --help
  -v, --version`)
    return
  }

  if (cli.version) {
    console.log('0.1.0')
    return
  }

  checkNodeVersion()

  const result = await boot(cli)
  const counts = result.index.counts
  const stats = result.index.getStats({ groupBy: 'day' })

  if (cli.json) {
    console.log(JSON.stringify({ projects: counts.projects, sessions: counts.sessions, turns: counts.turns, apiCalls: stats.totals.apiCalls, cost: stats.totals.cost }))
    await result.close()
    return
  }

  const shutdown = async () => {
    log.info('shutting down…')
    await result.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  log.info(`ready → ${result.url}`)
  log.info(`${counts.projects} projects · ${counts.sessions} sessions · ${formatCost(stats.totals.cost)} tracked`)
  if (cli.open) openBrowser(result.url)
}

// Allow direct execution (dev: `tsx watch server/main.ts -- --port 4317`, or the
// bundled dist-server/index.js run directly) in addition to being imported and
// invoked as `main(argv)` by bin/claude-dash.mjs.
const isDirectRun = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`
  } catch {
    return false
  }
})()
if (isDirectRun) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
