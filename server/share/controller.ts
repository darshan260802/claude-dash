// Owns the public-share *lifecycle* — starting/stopping the Cloudflare
// Quick Tunnel via `untun` and tracking state + scope across the run —
// layered on top of gate.ts's gate, which is deliberately auth-only (code
// verification, host allow-list, session tokens). A single controller
// instance is created once at server startup (see boot.ts) and handed to
// createApp() for both the auth middleware chain and the /api/share/*
// routes, which is what lets sharing be started, scoped, and stopped at
// runtime from the dashboard.
//
// Ported from cursor-dash's server/shareController.js (commit 7ff503b),
// with a Scope layered in on top — everything about the tunnel process
// itself and its two documented gotchas (the unhandledRejection filter,
// process.setMaxListeners) is unchanged.

import { createShareGate, generateCode, type ShareGate } from './gate.ts'
import { Scope, type ShareItem, type ShareItemSnapshot, type ShareMode } from './scope.ts'
// Type-only import — untun itself is loaded dynamically inside start() (see
// below), so this never pulls the real module (or its cloudflared binary
// download logic) into a cold, non-sharing boot.
import type { Tunnel as UntunTunnel } from 'untun'

// untun registers its own process-level SIGINT/SIGTERM/SIGHUP handlers every
// time startTunnel() is called and never removes them, so repeated
// start/stop cycles from the dashboard slowly accumulate listeners. They're
// harmless (each just races the same cleanup), but Node warns past 10 by
// default — raise the ceiling rather than let a normal session of a few
// start/stops print a MaxListenersExceededWarning.
process.setMaxListeners(20)

// untun's cloudflared wrapper creates a per-tunnel "connections" promise that
// it never exposes through untun's public startTunnel() API and never
// attaches a rejection handler to — unlike its sibling `url` promise, which
// the library defensively no-ops. Every time the cloudflared child process
// exits — including the *graceful* exit our own stop() triggers on purpose —
// that orphaned promise rejects with nobody listening, which Node treats as
// an unhandled rejection and crashes the whole process by default.
// Reproduced in cursor-dash: without this handler, "Stop sharing" took the
// entire dashboard down with it. Only this specific, recognizable message is
// swallowed — anything else still crashes the process exactly as Node's
// default would, so an unrelated real bug doesn't go silently unnoticed.
let unhandledRejectionInstalled = false
function installUnhandledRejectionGuard(): void {
  if (unhandledRejectionInstalled) return
  unhandledRejectionInstalled = true
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    if (/cloudflared exited .* before URL was ready/.test(message)) return
    console.error('[claude-dash] unhandled rejection:', reason)
    process.exit(1)
  })
}

export interface ShareStatus {
  state: 'idle' | 'starting' | 'active' | 'error'
  url: string | null
  code: string | null
  startedAt: number | null
  error: string | null
  mode: ShareMode
  items: ShareItemSnapshot[]
}

/** Creates the controller, starting idle — inactive until start() is called
 * from the Share page or the scope/add endpoint. */
export function createShareController() {
  installUnhandledRejectionGuard()

  const gate: ShareGate = createShareGate()

  let port: number | null = null
  let state: ShareStatus['state'] = 'idle'
  let publicUrl: string | null = null
  let code: string | null = null
  let startedAt: number | null = null
  let error: string | null = null
  let tunnel: UntunTunnel | null = null
  let startPromise: Promise<ShareStatus> | null = null
  let scope: Scope = Scope.scoped()

  function setPort(p: number): void {
    port = p
  }

  function status(): ShareStatus {
    return { state, url: publicUrl, code, startedAt, error, mode: scope.mode, items: scope.items() }
  }

  function isActive(): boolean {
    return state === 'active'
  }

  function currentScope(): Scope {
    return scope
  }

  /** Replaces the whole scope object — used when starting fresh (idle) and
   * when the owner deliberately widens/narrows past what add/remove can
   * express (global -> scoped via "share only this instead"). */
  function setScope(next: Scope): void {
    scope = next
  }

  /** Starts a fresh tunnel + code against whatever scope is currently set
   * (call setScope first). Idempotent while already starting or active —
   * returns the in-flight/latest result rather than racing a second
   * cloudflared process. Failures degrade to state: 'error' and leave the
   * local dashboard (and gate) untouched. */
  async function start(): Promise<ShareStatus> {
    if (state === 'active') return status()
    if (state === 'starting' && startPromise) return startPromise

    state = 'starting'
    error = null

    startPromise = (async () => {
      try {
        const { startTunnel } = await import('untun')
        const newTunnel = await startTunnel({ port: port ?? undefined, acceptCloudflareNotice: true })
        if (!newTunnel) throw new Error('tunnel setup did not complete')
        const url = await newTunnel.getURL()

        const newCode = generateCode()
        gate.setCode(newCode)
        gate.addAllowedHost(new URL(url).hostname)

        tunnel = newTunnel
        publicUrl = url
        code = newCode
        startedAt = Date.now()
        state = 'active'
        error = null
        return status()
      } catch (err) {
        console.error(`[claude-dash] could not start a public tunnel: ${(err as Error).message}`)
        state = 'error'
        error = (err as Error).message
        publicUrl = null
        code = null
        startedAt = null
        tunnel = null
        return status()
      } finally {
        startPromise = null
      }
    })()

    return startPromise
  }

  /** Tears down the tunnel process and revokes access — but never touches
   * the main HTTP server, so the local dashboard keeps running untouched.
   * Safe to call from idle/error (no-op past clearing state). */
  async function stop(): Promise<ShareStatus> {
    if (state === 'starting' && startPromise) {
      // Let the in-flight start settle first so we don't leak a tunnel
      // process that finishes coming up right after we told it to stop.
      await startPromise
    }

    const previousUrl = publicUrl
    const activeTunnel = tunnel

    gate.revokeAllTokens()
    if (previousUrl) {
      try {
        gate.removeAllowedHost(new URL(previousUrl).hostname)
      } catch {
        /* malformed URL never made it this far in practice */
      }
    }
    gate.clearCode()

    tunnel = null
    publicUrl = null
    code = null
    startedAt = null
    error = null
    state = 'idle'
    scope = Scope.scoped()

    if (activeTunnel) {
      try {
        await activeTunnel.close()
      } catch {
        /* best-effort — the process may already be gone */
      }
    }

    return status()
  }

  return {
    setPort,
    start,
    stop,
    status,
    isActive,
    get state() {
      return state
    },
    scope: currentScope,
    setScope,
    // Gate passthrough — same objects/semantics gate.ts always exposed, just
    // reached through the controller now that it's the thing held for the
    // life of the process.
    isAllowedHost: gate.isAllowedHost,
    isAuthorized: gate.isAuthorized,
    isOwnerRequest: gate.isOwnerRequest,
    verify: gate.verify,
    setAccessCookie: gate.setAccessCookie,
    clearAccessCookie: gate.clearAccessCookie,
  }
}

export type ShareController = ReturnType<typeof createShareController>
export type { ShareItem, ShareMode }
