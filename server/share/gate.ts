// Auth for sharing: an 8-character access code gate in front of the public
// tunnel URL, plus the host allow-list that keeps a stray Host header (or a
// DNS-rebinding attempt) from reaching the API. The gate is always
// constructed (see controller.ts) but starts with no code, in which case
// `isAuthorized` passes everything through — so the plain local path (no
// share ever started) goes through the same code path instead of being
// skipped entirely, and is unaffected in practice.
//
// Ported from cursor-dash's server/share.js (commit 7ff503b), re-expressed
// against Hono's Context instead of node:http's raw req/res.

import crypto from 'node:crypto'
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { getConnInfo } from '@hono/node-server/conninfo'

// No 0/O/1/I/L/U — every remaining character is unambiguous read aloud or
// typed from a screenshot.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 8
const TOKEN_TTL_MS = 24 * 60 * 60_000
const MAX_FAILURES = 10
const LOCKOUT_MS = 5 * 60_000
const FAILURE_DELAY_MS = 250
export const ACCESS_COOKIE = 'claude_dash_access'

export function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
  return out
}

/** "H6S8SGA7" -> "H6S8-SGA7" — purely a display convenience (the Share page,
 * the gate page's boxes); normalizeCode strips the hyphen right back out, so
 * a code copied with or without it always verifies. */
export function formatCodeForDisplay(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

// Exported for unit testing (test/shareGate.test.ts) — neither is reached
// through any other exported entry point without a full Hono Context.
export function normalizeCode(input: unknown): string {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/** Constant-time string compare that doesn't leak length via early return —
 * a length mismatch still does a same-cost dummy comparison before failing. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

function clientKey(c: Context): string {
  const cf = c.req.header('cf-connecting-ip')
  if (cf) return cf
  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  try {
    const addr = getConnInfo(c).remote.address
    if (addr) return addr
  } catch {
    /* no underlying socket info available (e.g. under a test harness) */
  }
  return 'unknown'
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

export type VerifyResult = { ok: true; token: string } | { ok: false; reason: 'invalid' | 'locked' }

/** Creates the share gate: host allow-list + code verification + session
 * tokens, all in memory. Starts inactive (no code) — activated/deactivated
 * at runtime via setCode/clearCode, which is what lets sharing be started
 * and stopped from the dashboard. A code is never written to disk, so it
 * (and every session issued against it) dies with the process at the
 * latest, same as the tunnel URL itself. */
export function createShareGate() {
  let currentCode: string | null = null
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  const tokens = new Map<string, number>() // token -> expiresAt
  const failures = new Map<string, { count: number; lockedUntil: number }>()

  function isActive(): boolean {
    return currentCode != null
  }

  function setCode(newCode: string): void {
    currentCode = newCode
  }

  /** Deactivates the gate: clears the code (so verify fails closed), drops
   * every issued session token, and restores the host allow-list to
   * loopback-only. Leaves the local dashboard itself untouched — this is
   * exactly the "stop sharing" operation, not a server shutdown. */
  function clearCode(): void {
    currentCode = null
    tokens.clear()
    allowedHosts.clear()
    allowedHosts.add('localhost')
    allowedHosts.add('127.0.0.1')
    allowedHosts.add('::1')
    allowedHosts.add('[::1]')
  }

  function revokeAllTokens(): void {
    tokens.clear()
  }

  /** Register the tunnel's public hostname once known (after the tunnel is
   * up), so requests forwarded through it pass the Host allow-list. */
  function addAllowedHost(host: string | undefined): void {
    if (host) allowedHosts.add(host)
  }

  function removeAllowedHost(host: string | undefined): void {
    if (host) allowedHosts.delete(host)
  }

  function isAllowedHost(hostHeader: string | undefined): boolean {
    if (!hostHeader) return false
    return allowedHosts.has(hostHeader.split(':')[0] ?? '')
  }

  /** The machine's own owner, talking to their own loopback address, never
   * needs the code — this is what keeps sharing a no-op for local use. */
  function isOwnerRequest(c: Context): boolean {
    return isLoopbackHost((c.req.header('host') || '').split(':')[0] ?? '')
  }

  function hasValidToken(c: Context): boolean {
    const token = getCookie(c, ACCESS_COOKIE)
    if (!token) return false
    const expiresAt = tokens.get(token)
    if (!expiresAt) return false
    if (Date.now() > expiresAt) {
      tokens.delete(token)
      return false
    }
    return true
  }

  function isLockedOut(key: string): boolean {
    const entry = failures.get(key)
    return !!entry && entry.lockedUntil > Date.now()
  }

  function recordFailure(key: string): void {
    const entry = failures.get(key) ?? { count: 0, lockedUntil: 0 }
    entry.count += 1
    if (entry.count >= MAX_FAILURES) {
      entry.lockedUntil = Date.now() + LOCKOUT_MS
      entry.count = 0
    }
    failures.set(key, entry)
  }

  /** Checks a submitted code, issuing an access-token cookie value on
   * success. Every attempt — right or wrong — pays a fixed delay, and
   * repeated failures from the same client lock it out for a few minutes,
   * so the ~6.6×10^11-combination code can't be brute-forced by anyone who
   * finds the tunnel URL. */
  async function verify(c: Context, submittedCode: unknown): Promise<VerifyResult> {
    const key = clientKey(c)
    if (!currentCode) return { ok: false, reason: 'invalid' }
    if (isLockedOut(key)) return { ok: false, reason: 'locked' }

    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS))

    if (!timingSafeEqualStr(normalizeCode(submittedCode), currentCode)) {
      recordFailure(key)
      return { ok: false, reason: 'invalid' }
    }

    failures.delete(key)
    const token = crypto.randomBytes(32).toString('base64url')
    tokens.set(token, Date.now() + TOKEN_TTL_MS)
    return { ok: true, token }
  }

  /** When the gate is inactive (no share running), every request is
   * authorized — this is what lets a single always-present gate object
   * serve both the plain local mode and an active share without the router
   * needing to branch on which mode it's in. */
  function isAuthorized(c: Context): boolean {
    if (!isActive()) return true
    return isOwnerRequest(c) || hasValidToken(c)
  }

  /** Sets the access cookie after a successful verify(). `secure` is
   * conditional on the request having actually arrived over HTTPS (the
   * tunnel terminates TLS and forwards x-forwarded-proto) — a bare Secure
   * flag would silently break the owner's own plain-HTTP loopback cookie. */
  function setAccessCookie(c: Context, token: string, secure: boolean): void {
    setCookie(c, ACCESS_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: Math.floor(TOKEN_TTL_MS / 1000),
      secure,
    })
  }

  function clearAccessCookie(c: Context): void {
    deleteCookie(c, ACCESS_COOKIE, { path: '/' })
  }

  return {
    addAllowedHost,
    removeAllowedHost,
    isAllowedHost,
    isOwnerRequest,
    isAuthorized,
    verify,
    setAccessCookie,
    clearAccessCookie,
    isActive,
    setCode,
    clearCode,
    revokeAllTokens,
  }
}

export type ShareGate = ReturnType<typeof createShareGate>
