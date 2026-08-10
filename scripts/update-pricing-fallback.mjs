#!/usr/bin/env node
// Regenerates server/pricing/fallback.json from LiteLLM's live pricing JSON.
// Run manually before each release (pricing, especially intro-pricing windows
// like Sonnet 5's through 2026-08-31, goes stale otherwise).
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const RELEVANT_PROVIDERS = new Set(['anthropic', 'deepseek', 'openai', 'gemini', 'vertex_ai-anthropic_models', 'bedrock'])
const OUT_PATH = fileURLToPath(new URL('../server/pricing/fallback.json', import.meta.url))

const res = await fetch(LITELLM_URL)
if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`)
const raw = await res.json()

const out = {}
for (const [key, value] of Object.entries(raw)) {
  if (!value || typeof value !== 'object') continue
  if (!RELEVANT_PROVIDERS.has(value.litellm_provider)) continue
  if (typeof value.input_cost_per_token !== 'number') continue
  out[key] = {
    input_cost_per_token: value.input_cost_per_token,
    output_cost_per_token: value.output_cost_per_token,
    cache_creation_input_token_cost: value.cache_creation_input_token_cost,
    cache_creation_input_token_cost_above_1hr: value.cache_creation_input_token_cost_above_1hr,
    cache_read_input_token_cost: value.cache_read_input_token_cost,
  }
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
await writeFile(OUT_PATH, JSON.stringify(sorted, null, 2) + '\n')
console.log(`wrote ${Object.keys(sorted).length} model prices to ${OUT_PATH}`)
