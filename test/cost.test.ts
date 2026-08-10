import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCost, resolvePriceKey } from '../server/pricing/cost.ts'

const OPUS_5_PRICE = {
  input_cost_per_token: 0.000005,
  output_cost_per_token: 0.000025,
  cache_creation_input_token_cost: 0.00000625, // 5m write rate
  cache_creation_input_token_cost_above_1hr: 0.00001, // 1h write rate
  cache_read_input_token_cost: 0.0000005,
}

test('computeCost applies the 5m and 1h cache-write rates separately, not a single blended rate', () => {
  const usage = {
    input_tokens: 100,
    output_tokens: 50,
    cache_read_input_tokens: 1000,
    cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 300 },
  }
  const cost = computeCost(OPUS_5_PRICE, usage)
  const expected = 100 * 0.000005 + 50 * 0.000025 + 200 * 0.00000625 + 300 * 0.00001 + 1000 * 0.0000005
  assert.ok(cost != null)
  assert.ok(Math.abs(cost - expected) < 1e-12, `expected ${expected}, got ${cost}`)
})

test('computeCost falls back to the 5m write rate when a model has no separate 1h rate (e.g. deepseek)', () => {
  const priceNoAbove1hr = {
    input_cost_per_token: 0.000000435,
    output_cost_per_token: 0.00000087,
    cache_creation_input_token_cost: 0,
    cache_read_input_token_cost: 0.000000003625,
    // cache_creation_input_token_cost_above_1hr intentionally absent
  }
  const usage = { input_tokens: 10, output_tokens: 5, cache_creation: { ephemeral_1h_input_tokens: 1000 } }
  const cost = computeCost(priceNoAbove1hr, usage)
  // falls back to cache_creation_input_token_cost (0) for the 1h bucket, not a crash / NaN
  assert.equal(cost, 10 * 0.000000435 + 5 * 0.00000087 + 1000 * 0)
})

test('computeCost returns null (not zero) for an unpriced/unknown model — never a silent $0', () => {
  const cost = computeCost(null, { input_tokens: 100, output_tokens: 100 })
  assert.equal(cost, null)
})

test('computeCost returns null when usage itself is missing', () => {
  const cost = computeCost(OPUS_5_PRICE, undefined)
  assert.equal(cost, null)
})

test('resolvePriceKey: exact match wins first', () => {
  const has = (k: string) => k === 'claude-opus-5'
  assert.equal(resolvePriceKey('claude-opus-5', has), 'claude-opus-5')
})

test('resolvePriceKey: strips a trailing -YYYYMMDD date snapshot as a fallback', () => {
  const has = (k: string) => k === 'claude-haiku-4-5'
  assert.equal(resolvePriceKey('claude-haiku-4-5-20251001', has), 'claude-haiku-4-5')
})

test('resolvePriceKey: tries an anthropic/ prefixed variant last', () => {
  const has = (k: string) => k === 'anthropic/claude-opus-5'
  assert.equal(resolvePriceKey('claude-opus-5', has), 'anthropic/claude-opus-5')
})

test('resolvePriceKey: returns null when nothing matches, rather than guessing', () => {
  const has = () => false
  assert.equal(resolvePriceKey('<synthetic>', has), null)
})
