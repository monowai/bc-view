import { ALL_MILESTONES } from "./definitions"
import {
  EarnedMilestone,
  MilestoneDefinition,
  MilestoneEvalData,
  MilestoneState,
  MilestoneTier,
} from "./types"

/**
 * Evaluate a single milestone against the current data and return the tier
 * the user qualifies for, or null if none.
 */
function evaluateTier(
  def: MilestoneDefinition,
  data: MilestoneEvalData,
): MilestoneTier | null {
  switch (def.id) {
    // ── Foundation ──────────────────────────────────────
    case "portfolio-builder": {
      const count = data.portfolioCount ?? 0
      if (count >= 5) return 3
      if (count >= 3) return 2
      if (count >= 1) return 1
      return null
    }
    case "first-steps": {
      const count = data.positionCount ?? 0
      if (count >= 100) return 3
      if (count >= 1) return 1
      return null
    }
    case "global-citizen": {
      const markets = data.marketCodes ?? []
      const unique = new Set(markets).size
      if (unique >= 4) return 3
      if (unique >= 3) return 2
      if (unique >= 2) return 1
      return null
    }
    case "independence-planner": {
      if (data.hasIndependencePlan) return 1
      return null
    }
    case "strategist": {
      if (data.hasRebalanceModel) return 1
      return null
    }

    // ── Consistency ─────────────────────────────────────
    case "monthly-investor": {
      const months = data.consecutiveInvestmentMonths ?? 0
      if (months >= 6) return 3
      if (months >= 3) return 2
      if (months >= 1) return 1
      return null
    }
    case "dividend-collector": {
      if ((data.dividendQuarters ?? 0) >= 4) return 3
      if ((data.dividendQuarters ?? 0) >= 4) return 2
      if (data.hasAnyDividend) return 1
      return null
    }

    // ── Diversification ─────────────────────────────────
    case "diversified": {
      const count = data.positionCount ?? 0
      if (count >= 20) return 3
      if (count >= 10) return 2
      if (count >= 5) return 1
      return null
    }
    case "balanced": {
      const maxWeight = data.maxPositionWeight ?? 100
      if (maxWeight <= 20) return 3
      if (maxWeight <= 30) return 2
      if (maxWeight <= 50) return 1
      return null
    }
    case "multi-asset": {
      const categories = data.assetCategoryNames ?? []
      const unique = new Set(categories).size
      if (unique >= 4) return 3
      if (unique >= 3) return 2
      if (unique >= 2) return 1
      return null
    }
    case "income-builder": {
      const count = data.dividendPositionCount ?? 0
      if (count >= 10) return 3
      if (count >= 5) return 2
      if (count >= 1) return 1
      return null
    }

    // ── Independence ────────────────────────────────────
    case "fi-progress": {
      const fi = data.fiProgress ?? 0
      if (fi >= 100) return 3
      if (fi >= 50) return 2
      if (fi >= 10) return 1
      return null
    }
    case "savings-champion": {
      const rate = data.savingsRate ?? 0
      if (rate >= 50) return 3
      if (rate >= 25) return 2
      if (rate >= 10) return 1
      return null
    }

    // ── Patience ────────────────────────────────────────
    case "hodler": {
      const years = data.oldestPositionYears ?? 0
      if (years >= 5) return 3
      if (years >= 3) return 2
      if (years >= 1) return 1
      return null
    }
    case "patient-investor": {
      const years = data.accountAgeYears ?? 0
      if (years >= 3) return 3
      if (years >= 1) return 2
      if (years >= 0.5) return 1
      return null
    }
    case "compounding": {
      const gainPct = data.totalGainPercent ?? 0
      if (gainPct >= 50) return 3
      if (gainPct >= 10) return 2
      if (gainPct > 0) return 1
      return null
    }

    // ── Net Worth ───────────────────────────────────────
    case "net-worth": {
      const nw = data.netWorthUsd ?? 0
      if (nw >= 1_000_000) return 3
      if (nw >= 100_000) return 2
      if (nw >= 10_000) return 1
      return null
    }

    default:
      return null
  }
}

/**
 * Evaluate all milestones against the current data.
 * Explorer milestones are NOT evaluated here — they use action tracking.
 *
 * Returns the full state of every non-explorer milestone.
 */
export function evaluateAll(
  data: MilestoneEvalData,
  earned: EarnedMilestone[],
): MilestoneState[] {
  const earnedMap = new Map(earned.map((e) => [e.milestoneId, e]))

  return ALL_MILESTONES.map((def) => {
    const isExplorer = def.category === "explorer"
    const earnedRecord = earnedMap.get(def.id)
    const computedTier = isExplorer ? null : evaluateTier(def, data)

    // Use the higher of computed or previously earned tier
    const currentTier =
      computedTier !== null && earnedRecord
        ? (Math.max(computedTier, earnedRecord.tier) as MilestoneTier)
        : (computedTier ?? (earnedRecord?.tier as MilestoneTier) ?? null)

    // Next tier is the one after the current earned tier
    const nextTier =
      currentTier !== null && currentTier < def.tiers.length
        ? (def.tiers.find((t) => t.tier === currentTier + 1) ?? null)
        : null

    return {
      definition: def,
      earnedTier: currentTier,
      earnedAt: earnedRecord?.earnedAt ?? null,
      nextTier,
    }
  })
}

/**
 * Find milestones that have been newly earned (computed tier > backend tier).
 * Returns only the milestones that need to be POSTed to the backend.
 */
export function findNewMilestones(
  data: MilestoneEvalData,
  earned: EarnedMilestone[],
): Array<{ milestoneId: string; tier: MilestoneTier }> {
  const earnedMap = new Map(earned.map((e) => [e.milestoneId, e]))
  const newMilestones: Array<{ milestoneId: string; tier: MilestoneTier }> = []

  for (const def of ALL_MILESTONES) {
    if (def.category === "explorer") continue
    const computedTier = evaluateTier(def, data)
    if (computedTier === null) continue

    const existingTier = earnedMap.get(def.id)?.tier ?? 0
    if (computedTier > existingTier) {
      newMilestones.push({ milestoneId: def.id, tier: computedTier })
    }
  }

  return newMilestones
}
