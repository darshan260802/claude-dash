import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { createShareGate, generateCode, formatCodeForDisplay, normalizeCode, timingSafeEqualStr, ACCESS_COOKIE } from '../server/share/gate.ts'

// ---------------------------------------------------------------------
// Pure helpers — no Context needed.
// ---------------------------------------------------------------------

test('generateCode: correct length and alphabet (no 0/O/1/I/L/U)', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateCode()
    assert.equal(code.length, 8)
    assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]+$/, `code "${code}" contains an excluded character`)
  }
})

test('formatCodeForDisplay / normalizeCode round-trip with and without the hyphen', () => {
  const code = 'H6S8SGA7'
  const displayed = formatCodeForDisplay(code)
  assert.equal(displayed, 'H6S8-SGA7')
  assert.equal(normalizeCode(displayed), code, 'hyphenated form normalizes back to the raw code')
  assert.equal(normalizeCode(code), code, 'unhyphenated form is already normalized')
  assert.equal(normalizeCode(' h6s8-sga7 '), code, 'lowercase and stray whitespace are also normalized')
})

test('timingSafeEqualStr: correct on match and mismatch, including different lengths', () => {
  assert.equal(timingSafeEqualStr('ABCDEFGH', 'ABCDEFGH'), true)
  assert.equal(timingSafeEqualStr('ABCDEFGH', 'ABCDEFGX'), false)
  assert.equal(timingSafeEqualStr('SHORT', 'MUCHLONGERSTRING'), false, 'length mismatch still returns false rather than throwing')
})

// ---------------------------------------------------------------------
// createShareGate() — exercised through a tiny in-memory Hono app so
// isOwnerRequest/isAuthorized/verify/setAccessCookie see a real Context
// (app.request() builds one without binding a real port).
// ---------------------------------------------------------------------

function testApp(gate: ReturnType<typeof createShareGate>) {
  const app = new Hono()
  app.get('/owner', (c) => c.json({ isOwner: gate.isOwnerRequest(c) }))
  app.get('/authorized', (c) => c.json({ authorized: gate.isAuthorized(c) }))
  app.post('/verify', async (c) => {
    const body = (await c.req.json()) as { code?: string }
    const result = await gate.verify(c, body.code)
    if (result.ok) gate.setAccessCookie(c, result.token, false)
    return c.json(result)
  })
  return app
}

function setCookieToken(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? ''
  const match = new RegExp(`${ACCESS_COOKIE}=([^;]+)`).exec(raw)
  assert.ok(match, `expected a ${ACCESS_COOKIE} cookie in Set-Cookie: ${raw}`)
  return match![1]!
}

test('isAuthorized is always true while the gate is inactive (pass-through)', async () => {
  const gate = createShareGate()
  const app = testApp(gate)
  const res = await app.request('/authorized', { headers: { host: '203.0.113.5' } }) // not loopback, no code ever set
  assert.deepEqual(await res.json(), { authorized: true })
})

test('isOwnerRequest is true only for a loopback Host header', async () => {
  const gate = createShareGate()
  const app = testApp(gate)
  for (const host of ['localhost', '127.0.0.1', '127.0.0.1:4317', 'localhost:4317']) {
    const res = await app.request('/owner', { headers: { host } })
    assert.deepEqual(await res.json(), { isOwner: true }, `expected ${host} to be owner`)
  }
  const res = await app.request('/owner', { headers: { host: 'example.trycloudflare.com' } })
  assert.deepEqual(await res.json(), { isOwner: false })
})

test('verify: wrong code fails, correct code (with or without the display hyphen) succeeds and issues a working cookie', async () => {
  const gate = createShareGate()
  const app = testApp(gate)
  const code = generateCode()
  gate.setCode(code)

  const wrong = await app.request('/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1' },
    body: JSON.stringify({ code: 'WRONGCODE' }),
  })
  assert.deepEqual(await wrong.json(), { ok: false, reason: 'invalid' })

  const rightWithHyphen = await app.request('/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1' },
    body: JSON.stringify({ code: formatCodeForDisplay(code) }),
  })
  const body = (await rightWithHyphen.json()) as { ok: boolean }
  assert.equal(body.ok, true)
  const token = setCookieToken(rightWithHyphen)

  const authorized = await app.request('/authorized', {
    headers: { host: 'example.trycloudflare.com', cookie: `${ACCESS_COOKIE}=${token}` },
  })
  assert.deepEqual(await authorized.json(), { authorized: true }, 'the issued cookie actually authorizes a subsequent non-owner request')
})

test('verify: 11th consecutive wrong attempt from the same client locks out; a different client is unaffected', async () => {
  const gate = createShareGate()
  const app = testApp(gate)
  gate.setCode(generateCode()) // some real code — irrelevant, every attempt below is wrong on purpose

  const attempt = (ip: string) =>
    app.request('/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify({ code: 'ALWAYSWRONG' }),
    })

  let last: { ok: boolean; reason?: string } = { ok: true }
  for (let i = 0; i < 10; i++) {
    last = (await (await attempt('203.0.113.9')).json()) as typeof last
  }
  assert.deepEqual(last, { ok: false, reason: 'invalid' }, 'the 10th failure itself is still just "invalid"')

  const eleventh = (await (await attempt('203.0.113.9')).json()) as typeof last
  assert.deepEqual(eleventh, { ok: false, reason: 'locked' })

  const otherClient = (await (await attempt('203.0.113.10')).json()) as typeof last
  assert.deepEqual(otherClient, { ok: false, reason: 'invalid' }, 'lockout is keyed per-client, not global')
})

test('host allow-list: add/remove and the loopback baseline that is never removable', () => {
  const gate = createShareGate()
  assert.equal(gate.isAllowedHost('localhost'), true)
  assert.equal(gate.isAllowedHost('127.0.0.1:4317'), true, 'a port suffix is stripped before checking')
  assert.equal(gate.isAllowedHost('example.trycloudflare.com'), false)

  gate.addAllowedHost('example.trycloudflare.com')
  assert.equal(gate.isAllowedHost('example.trycloudflare.com'), true)

  gate.removeAllowedHost('example.trycloudflare.com')
  assert.equal(gate.isAllowedHost('example.trycloudflare.com'), false)
  assert.equal(gate.isAllowedHost('localhost'), true, 'loopback baseline survives removing an unrelated host')
})

test('clearCode resets the host allow-list to loopback-only, and revokes tokens so they do not carry over to the next share', async () => {
  const gate = createShareGate()
  const app = testApp(gate)
  const code = generateCode()
  gate.setCode(code)
  gate.addAllowedHost('example.trycloudflare.com')

  const res = await app.request('/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  const token = setCookieToken(res)

  gate.clearCode()
  assert.equal(gate.isAllowedHost('example.trycloudflare.com'), false, 'tunnel host no longer allowed after stop')
  assert.equal(gate.isActive(), false)

  // Start a brand new share (fresh code) and confirm the OLD token from the
  // previous share no longer authorizes anything against it.
  const newCode = generateCode()
  gate.setCode(newCode)
  const staleTokenResult = await app.request('/authorized', {
    headers: { host: 'some-visitor-host.example', cookie: `${ACCESS_COOKIE}=${token}` },
  })
  assert.deepEqual(await staleTokenResult.json(), { authorized: false }, 'a token issued before clearCode does not survive into the next share')
})
