import type { Usage } from '@shared/records.ts'
import type { UsageTotals } from '@shared/types.ts'
import type { PricingService } from '../pricing/PricingService.ts'
import { computeCost } from '../pricing/cost.ts'

export function emptyTotals(): UsageTotals {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
}

export function addUsageToTotals(totals: UsageTotals, usage: Usage | undefined): void {
  if (!usage) return
  totals.input += usage.input_tokens ?? 0
  totals.output += usage.output_tokens ?? 0
  totals.cacheRead += usage.cache_read_input_tokens ?? 0
  totals.cacheWrite5m += usage.cache_creation?.ephemeral_5m_input_tokens ?? 0
  totals.cacheWrite1h += usage.cache_creation?.ephemeral_1h_input_tokens ?? 0
}

export interface UsageAddResult {
  counted: boolean
  cost: number | null
}

/** Tracks which turn keys (see turns.ts `turnKey` — every assistant TurnDTO's
 * `id`, which is always unique per real API call or per synthetic fallback)
 * have already had their usage counted, GLOBALLY across every file in the
 * index — not per-file, per-session, or per-project. This is what catches
 * both the within-file duplicate-line pattern (one JSONL line per content
 * block, same key repeated — already collapsed to one TurnDTO by
 * groupIntoTurns before it ever reaches here) and the confirmed cross-file
 * fork/resume case where two different session files share identical usage
 * keys for what was really one API call.
 *
 * Sessions are fully re-derived from their accumulated raw lines on every
 * file-watcher tail (see SessionIndex), so `add()` must be idempotent for the
 * SAME owner re-submitting a key it already claimed — only a DIFFERENT
 * session claiming an already-owned key is suppressed. Callers must still
 * process files in a deterministic order (oldest mtime first) so which
 * session "wins" a shared key is stable across restarts. */
export class UsageAccumulator {
  private seen = new Map<string, string>() // key -> owning session id (first writer wins)

  add(key: string, ownerSessionId: string, model: string | undefined, usage: Usage | undefined, pricing: PricingService): UsageAddResult {
    const price = model ? pricing.get(model) : null
    const cost = computeCost(price, usage)

    const existingOwner = this.seen.get(key)
    if (existingOwner !== undefined && existingOwner !== ownerSessionId) {
      return { counted: false, cost: null }
    }
    this.seen.set(key, ownerSessionId)
    return { counted: true, cost }
  }

  ownerOf(key: string): string | undefined {
    return this.seen.get(key)
  }

  /** Remove every key attributed to `sessionId` — used when a file is
   * truncated/rewritten and must be fully re-indexed from scratch. */
  releaseSession(sessionId: string): void {
    for (const [key, owner] of this.seen) {
      if (owner === sessionId) this.seen.delete(key)
    }
  }

  get size(): number {
    return this.seen.size
  }
}
