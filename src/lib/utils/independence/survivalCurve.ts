import type { MonteCarloResult } from "types/independence"

export interface SurvivalPoint {
  age: number
  /** Fraction of simulation paths still funded at this age: 0..1 */
  survival: number
}

export interface SurvivalCurve {
  points: SurvivalPoint[]
  /**
   * Age thresholds where survival first drops below each level.
   * Value stored = last age where survival was ≥ that level.
   * Omitted when survival never drops below the level.
   */
  thresholds: {
    p90?: number
    p75?: number
    p50?: number
  }
  /** Plain-language headline for the ribbon, e.g. "9 in 10 futures still funded at age 81 · 3 in 4 at age 87 · half at age 91" */
  headline: string
}

/**
 * Derives a per-age survival curve from a MonteCarloResult.
 *
 * Age axis: yearlyBands rows that carry an `age` value; falls back to the
 * histogram key range when no band ages are present.
 *
 * survival(age) = 1 − Σ histogram[a≤age] / iterations
 *
 * Pure function — no React, no side effects.
 */
export function deriveSurvivalCurve(result: MonteCarloResult): SurvivalCurve {
  const { iterations, yearlyBands, depletionAgeDistribution } = result
  const { histogram } = depletionAgeDistribution

  // --- Age axis ----------------------------------------------------------------
  const bandAges = yearlyBands
    .map((b) => b.age)
    .filter((a): a is number => a != null)

  const histKeys = Object.keys(histogram).map(Number)

  let startAge: number
  let endAge: number

  if (bandAges.length > 0) {
    startAge = Math.min(...bandAges)
    endAge = Math.max(...bandAges)
  } else if (histKeys.length > 0) {
    startAge = Math.min(...histKeys)
    endAge = Math.max(...histKeys)
  } else {
    return { points: [], thresholds: {}, headline: "No simulation data" }
  }

  // --- Depletion lookup --------------------------------------------------------
  const depletionByAge = new Map<number, number>()
  for (const key of histKeys) {
    depletionByAge.set(key, histogram[key])
  }

  // --- Survival per age --------------------------------------------------------
  let cumulativeDepletion = 0
  const points: SurvivalPoint[] = []
  for (let age = startAge; age <= endAge; age++) {
    cumulativeDepletion += depletionByAge.get(age) ?? 0
    const survival = iterations > 0 ? 1 - cumulativeDepletion / iterations : 1
    points.push({ age, survival })
  }

  // --- Thresholds: last age where survival ≥ level ----------------------------
  const thresholds: SurvivalCurve["thresholds"] = {}
  for (let i = 0; i < points.length; i++) {
    const { survival } = points[i]
    if (thresholds.p90 === undefined && survival < 0.9) {
      // Store the last age where survival was still ≥ 0.90
      thresholds.p90 = i > 0 ? points[i - 1].age : points[i].age
    }
    if (thresholds.p75 === undefined && survival < 0.75) {
      thresholds.p75 = i > 0 ? points[i - 1].age : points[i].age
    }
    if (thresholds.p50 === undefined && survival < 0.5) {
      thresholds.p50 = i > 0 ? points[i - 1].age : points[i].age
    }
  }

  // --- Headline ----------------------------------------------------------------
  const parts: string[] = []
  if (thresholds.p90 != null) {
    parts.push(`9 in 10 futures still funded at age ${thresholds.p90}`)
  }
  if (thresholds.p75 != null) {
    parts.push(`3 in 4 at age ${thresholds.p75}`)
  }
  if (thresholds.p50 != null) {
    parts.push(`half at age ${thresholds.p50}`)
  }

  const headline =
    parts.length === 0
      ? "9 in 10 futures stay funded for life"
      : parts.join(" · ")

  return { points, thresholds, headline }
}
