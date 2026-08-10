import type { ModelPrice } from '@shared/types.ts'
import type { Usage } from '@shared/records.ts'

/** Exact cost — not an approximation. Claude Code's own `usage.cache_creation`
 * already splits 5-minute vs 1-hour ephemeral cache writes, so unlike tools
 * that only see a combined `cache_creation_input_tokens` figure, we don't need
 * to guess which write-rate multiplier applies. */
export function computeCost(price: ModelPrice | null, usage: Usage | undefined): number | null {
  if (!price || !usage) return null
  const cc = usage.cache_creation ?? {}
  const write1h = price.cache_creation_input_token_cost_above_1hr ?? price.cache_creation_input_token_cost ?? 0

  return (
    (usage.input_tokens ?? 0) * (price.input_cost_per_token ?? 0) +
    (usage.output_tokens ?? 0) * (price.output_cost_per_token ?? 0) +
    (cc.ephemeral_5m_input_tokens ?? 0) * (price.cache_creation_input_token_cost ?? 0) +
    (cc.ephemeral_1h_input_tokens ?? 0) * write1h +
    (usage.cache_read_input_tokens ?? 0) * (price.cache_read_input_token_cost ?? 0)
  )
}

/** Model-key lookup with graceful fallbacks: exact match, then the ID with a
 * trailing -YYYYMMDD date snapshot stripped, then an `anthropic/` prefixed
 * variant some pricing sources use. */
export function resolvePriceKey(model: string, has: (key: string) => boolean): string | null {
  if (has(model)) return model
  const dateStripped = model.replace(/-\d{8}$/, '')
  if (dateStripped !== model && has(dateStripped)) return dateStripped
  const prefixed = `anthropic/${model}`
  if (has(prefixed)) return prefixed
  return null
}
