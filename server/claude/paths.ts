import { homedir } from 'node:os'
import { join, delimiter } from 'node:path'
import { existsSync, statSync } from 'node:fs'

/** Minimal path-manipulation surface, injectable so paths.ts logic can be unit
 * tested against path.win32 without a real Windows machine. */
export interface PathAdapter {
  join(...parts: string[]): string
  sep: string
  isAbsolute(p: string): boolean
}

export const posixAdapter: PathAdapter = {
  join: (...p) => p.join('/').replace(/\/+/g, '/'),
  sep: '/',
  isAbsolute: (p) => p.startsWith('/'),
}

export const win32Adapter: PathAdapter = {
  join: (...p) => p.join('\\'),
  sep: '\\',
  isAbsolute: (p) => /^[a-zA-Z]:\\/.test(p) || p.startsWith('\\\\'),
}

export interface ResolvedClaudeDirs {
  dirs: string[]
  detectedFrom: 'flag' | 'env' | 'default'
}

/** Resolve one or more `~/.claude`-equivalent roots.
 * Precedence: --claude-dir flag(s) > CLAUDE_CONFIG_DIR env (path.delimiter-separated
 * list; keep every entry that has a projects/ dir) > os.homedir()/.claude. */
export function resolveClaudeDirs(flagDirs: string[], env = process.env): ResolvedClaudeDirs {
  if (flagDirs.length > 0) {
    return { dirs: flagDirs, detectedFrom: 'flag' }
  }
  const envVal = env.CLAUDE_CONFIG_DIR
  if (envVal) {
    const candidates = envVal.split(delimiter).map((s) => s.trim()).filter(Boolean)
    const valid = candidates.filter((d) => existsSync(join(d, 'projects')))
    if (valid.length > 0) return { dirs: valid, detectedFrom: 'env' }
    // env var set but nothing resolvable — fall through to default rather than
    // silently indexing nothing
  }
  return { dirs: [join(homedir(), '.claude')], detectedFrom: 'default' }
}

export function projectsDir(claudeDir: string): string {
  return join(claudeDir, 'projects')
}

export function subagentsDir(projectDir: string, sessionId: string): string {
  return join(projectDir, sessionId, 'subagents')
}

export function toolResultsDir(projectDir: string, sessionId: string): string {
  return join(projectDir, sessionId, 'tool-results')
}

/** Naive de-slug fallback ONLY — real cwd should always be read from a record's
 * `cwd` field first. `slug.replace(/-/g, sep)` is lossy whenever the real path
 * contains a hyphen (e.g. "ollama-usage-monitor" would wrongly become
 * "ollama/usage/monitor"), so this is a last resort. */
export function naiveDeslug(dirName: string, adapter: PathAdapter = posixAdapter): string {
  const withSep = dirName.replace(/-/g, adapter.sep)
  return adapter.isAbsolute(withSep) ? withSep : adapter.sep + withSep.replace(/^\/+/, '')
}

export function cwdToSlug(cwd: string): string {
  return cwd.replace(/[/\\:]/g, '-')
}

export function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}
