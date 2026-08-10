import { spawn } from 'node:child_process'

/** Hand-rolled browser opener — deliberately NOT the `open` npm package, which
 * resolves a helper script relative to its own node_modules path at runtime and
 * breaks once bundled by tsup into a single file with no node_modules alongside it. */
export function openBrowser(url: string): void {
  try {
    let cmd: string
    let args: string[]
    if (process.platform === 'darwin') {
      cmd = 'open'
      args = [url]
    } else if (process.platform === 'win32') {
      cmd = 'cmd'
      args = ['/c', 'start', '""', url]
    } else {
      cmd = 'xdg-open'
      args = [url]
    }
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.on('error', () => {
      // headless environment, no browser opener available — the URL is already
      // printed to the console, so this is a normal case, not a failure.
    })
    child.unref()
  } catch {
    // never let a browser-open failure affect server boot
  }
}
