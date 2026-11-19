import type {
  RetirementProjection,
  YearlyPercentileBand,
} from "types/independence"

/** Drawing more or less than this share off plan moves out of "on track". */
const GUARDRAIL_TOLERANCE = 0.2

/** True once the plan owner has reached the plan's retirement age. */
export function isRetired(projection: RetirementProjection | null): boolean {
  const currentAge = projection?.planInputs?.currentAge
  const retirementAge = projection?.planInputs?.retirementAge
  if (currentAge == null || retirementAge == null) return false
  return currentAge >= retirementAge
}

/**
 * This year's planned draw on the liquid pot: expenses less guaranteed
 * income, as svc-retire projects it.
 */
export function plannedAnnualDrawdown(
  projection: RetirementProjection,
): number {
  return projection.yearlyProjections[0]?.withdrawals ?? 0
}

export type GuardrailBand = "under" | "onTrack" | "over" | "none"

export interface WithdrawalGuardrail {
  /** Actual draw as a percentage of liquid assets. */
  actualRate: number
  /** Planned draw as a percentage of liquid assets. */
  plannedRate: number
  band: GuardrailBand
}

/**
 * Compare the actual draw with the planned draw. Within 20% of plan is on
 * track; beyond that the retiree should trim spending, or has room to spend.
 */
export function withdrawalGuardrail(
  actualAnnual: number,
  plannedAnnual: number,
  liquidAssets: number,
): WithdrawalGuardrail {
  if (plannedAnnual <= 0 || liquidAssets <= 0) {
    return {
      actualRate: liquidAssets > 0 ? (actualAnnual / liquidAssets) * 100 : 0,
      plannedRate: 0,
      band: "none",
    }
  }
  const ratio = actualAnnual / plannedAnnual
  const band: GuardrailBand =
    ratio > 1 + GUARDRAIL_TOLERANCE
      ? "over"
      : ratio < 1 - GUARDRAIL_TOLERANCE
        ? "under"
        : "onTrack"
  return {
    actualRate: (actualAnnual / liquidAssets) * 100,
    plannedRate: (plannedAnnual / liquidAssets) * 100,
    band,
  }
}

/**
 * First age at which the median and the bottom-10% simulated paths run dry.
 * Null means that path lasts the whole horizon.
 */
export function moneyLastsTo(bands: YearlyPercentileBand[]): {
  median: number | null
  badCase: number | null
} {
  const firstDry = (pick: (b: YearlyPercentileBand) => number): number | null =>
    bands.find((b) => b.age != null && pick(b) <= 0)?.age ?? null
  return { median: firstDry((b) => b.p50), badCase: firstDry((b) => b.p10) }
}
