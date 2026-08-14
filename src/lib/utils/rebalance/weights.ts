import { AssetWeightWithDetails } from "types/rebalance"

/**
 * Scale every item's `weight` proportionally so the set sums to EXACTLY
 * 100.00. Mirrors the "Normalize to 100%" affordance shared by
 * ModelWeightsEditor, ImportHoldingsDialog, and CreateModelFromHoldingsDialog.
 *
 * Rounding each item's scaled weight independently (naive `Math.round`) can
 * leave the set a hundredth or two short of 100 — e.g. three items at
 * 33.33/33.33/33.33 round to themselves and sum to 99.99, which trips
 * `weightsSumValid` and makes "Normalize to 100%" a no-op. Instead this uses
 * largest-remainder allocation (a.k.a. Hamilton's method): scale every
 * weight, floor each to 2dp (hundredths), then hand the few 0.01-sized
 * hundredths still owed out to the items whose floor discarded the largest
 * fractional remainder — ties broken by original array index — until the
 * set sums to exactly 100.00.
 *
 * Returns `null` when `totalWeight` is 0 — callers must treat that as a
 * no-op (do not call onChange/setState), matching the original inline
 * `if (totalWeight === 0) return` guard at each call site. Also returns
 * `null` for a non-finite total (NaN/Infinity) — a division that would
 * otherwise silently produce non-finite weights.
 */
export function normalizeWeights<T extends { weight: number }>(
  items: T[],
  totalWeight: number,
): T[] | null {
  if (!Number.isFinite(totalWeight) || totalWeight === 0) return null
  if (items.length === 0) return []
  const factor = 100 / totalWeight

  // Work in hundredths (integer cents-of-a-percent) so "the two leftover
  // hundredths" is an exact integer distribution, not more floating-point
  // rounding on top of floating-point rounding.
  const scaled = items.map((item, index) => {
    const exactCents = item.weight * factor * 100
    // The tiny epsilon only corrects float representation noise (e.g.
    // 6666.999999999999 for a true 6667) — far smaller than any genuine
    // fractional remainder, so it never bumps a real fraction up early.
    const flooredCents = Math.floor(exactCents + 1e-9)
    return { index, flooredCents, remainder: exactCents - flooredCents }
  })

  const totalFlooredCents = scaled.reduce((sum, s) => sum + s.flooredCents, 0)
  let remainingCents = 10000 - totalFlooredCents

  const byRemainderDesc = [...scaled].sort((a, b) =>
    b.remainder !== a.remainder ? b.remainder - a.remainder : a.index - b.index,
  )

  const cents = scaled.map((s) => s.flooredCents)
  for (const s of byRemainderDesc) {
    if (remainingCents <= 0) break
    cents[s.index] += 1
    remainingCents -= 1
  }

  return items.map((item, index) => ({
    ...item,
    weight: cents[index] / 100,
  }))
}

/**
 * True when a set of percentage weights sums to (within floating-point
 * tolerance) 100%.
 */
export function weightsSumValid(totalWeight: number): boolean {
  return Math.abs(totalWeight - 100) < 0.01
}

/**
 * Clamps a typed weight-percent entry to the valid [0, 100] range. A
 * non-finite input (NaN from an empty/invalid parse, or +-Infinity) clamps
 * to 0 rather than propagating — mirrors the `|| 0` fallback already used
 * at every typed-weight call site, just without letting an out-of-range
 * number (e.g. typing "500") slip through unclamped.
 */
export function clampWeightPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** Converts a decimal ratio (0-1, as stored server-side) to a percentage
 *  rounded to 2dp (as edited in the UI). */
export function toWeightPercent(decimal: number): number {
  return Math.round(decimal * 10000) / 100
}

/** Converts a percentage (as edited in the UI) to the decimal ratio the
 *  backend expects. */
export function toWeightDecimal(percent: number): number {
  return Math.round(percent * 100) / 10000
}

export interface PlanAssetPayload {
  assetId: string
  weight: number
  assetCode?: string
  assetName?: string
  capturedPrice?: number
  priceCurrency?: string
  rationale?: string
  sortOrder: number
}

export interface PlanAssetsPayload {
  assets: PlanAssetPayload[]
}

/**
 * Builds the PUT `/plans/{id}` request body from editable UI weights —
 * the payload shared verbatim by the plan's Save action and the
 * silent pre-fetch-prices save.
 */
export function buildPlanAssetsPayload(
  weights: AssetWeightWithDetails[],
): PlanAssetsPayload {
  return {
    assets: weights.map((w, index) => ({
      assetId: w.assetId,
      weight: toWeightDecimal(w.weight),
      assetCode: w.assetCode,
      assetName: w.assetName,
      capturedPrice: w.capturedPrice,
      priceCurrency: w.priceCurrency,
      rationale: w.rationale || undefined,
      sortOrder: w.sortOrder ?? index,
    })),
  }
}
