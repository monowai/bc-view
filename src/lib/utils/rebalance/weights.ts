import { AssetWeightWithDetails } from "types/rebalance"

/**
 * Scale every item's `weight` proportionally so the set sums to 100,
 * rounded to 2dp. Mirrors the "Normalize to 100%" affordance shared by
 * ModelWeightsEditor, ImportHoldingsDialog, and CreateModelFromHoldingsDialog.
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
  const factor = 100 / totalWeight
  return items.map((item) => ({
    ...item,
    weight: Math.round(item.weight * factor * 100) / 100,
  }))
}

/**
 * True when a set of percentage weights sums to (within floating-point
 * tolerance) 100%.
 */
export function weightsSumValid(totalWeight: number): boolean {
  return Math.abs(totalWeight - 100) < 0.01
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
