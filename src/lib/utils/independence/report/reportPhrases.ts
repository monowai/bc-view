/**
 * Phrase catalogue for the Independence analysis report.
 *
 * Every sentence in the report is a fixed string with typed slots. Slot
 * values arrive already formatted; a phrase only concatenates. Branching
 * (which key to use) happens in buildReport, never in here. A test fails if
 * a FindingsService code has no entry, so new backend findings force a
 * phrase. Bump REPORT_TEMPLATE_VERSION whenever wording or layout changes.
 *
 * Spec: bc-claude/INDEPENDENCE_REPORT.md → Narrative.
 */
export const REPORT_TEMPLATE_VERSION = "0.2"

/** Finding codes svc-retire's FindingsService can emit today. */
export const FINDING_CODES = [
  "PROFILE_INCOMPLETE",
  "OFF_TRACK",
  "ON_TRACK",
  "HORIZON_EXCEEDS_FIRE_WINDOW",
  "REAL_RETURN_BELOW_SWR",
  "COAST_FI_REACHED",
  "CONTRIBUTION_LIMIT_401K",
  "CONTRIBUTION_LIMIT_IRA",
  "ISA_ALLOWANCE_EXCEEDED",
] as const

export type FindingCode = (typeof FINDING_CODES)[number]

/** Findings that only matter under a FIRE lens; tagged when strategy ≠ FIRE. */
export const FIRE_LENS_CODES: ReadonlySet<string> = new Set([
  "HORIZON_EXCEEDS_FIRE_WINDOW",
  "REAL_RETURN_BELOW_SWR",
  "COAST_FI_REACHED",
])

/**
 * Report-side gloss per finding code — one short line printed under the
 * backend's own title/detail so the reader knows what to do with it.
 */
const FINDING_GLOSS: Record<FindingCode, string> = {
  PROFILE_INCOMPLETE:
    "Set your date of birth so every age in this report is exact.",
  OFF_TRACK:
    "The plan runs out before the horizon. See the verdict for what closes the gap.",
  ON_TRACK: "No change needed to reach the horizon on the current settings.",
  HORIZON_EXCEEDS_FIRE_WINDOW:
    "The 4% rule assumes a 30-year window. Longer horizons need a lower withdrawal rate.",
  REAL_RETURN_BELOW_SWR:
    "Returns after inflation sit below the withdrawal rate, so capital erodes each year.",
  COAST_FI_REACHED:
    "Existing assets alone grow to the independence number. New contributions only bring the date forward.",
  CONTRIBUTION_LIMIT_401K:
    "Planned contributions exceed the annual 401(k) limit. The excess is treated as taxable savings.",
  CONTRIBUTION_LIMIT_IRA:
    "Planned contributions exceed the annual IRA limit. The excess is treated as taxable savings.",
  ISA_ALLOWANCE_EXCEEDED:
    "Planned contributions exceed the annual ISA allowance. The excess is treated as taxable savings.",
}

export function isFindingCode(code: string): code is FindingCode {
  return (FINDING_CODES as readonly string[]).includes(code)
}

export function findingPhrase(code: FindingCode): string {
  return FINDING_GLOSS[code]
}

type Slots<K extends string> = Record<K, string>

export const phrases = {
  AGE_LINE: (s: Slots<"currentAge" | "lifeExpectancy" | "retirementAge">) =>
    `Age ${s.currentAge}, planning to age ${s.lifeExpectancy}, independence target age ${s.retirementAge}`,

  VERDICT_FUNDED: (s: Slots<"lifeExpectancy" | "terminalP50">) =>
    `Your plan funds every year to age ${s.lifeExpectancy} with ${s.terminalP50} to spare in the median case.`,
  VERDICT_FUNDED_NO_MC: (s: Slots<"lifeExpectancy">) =>
    `Your plan funds every year to age ${s.lifeExpectancy}.`,
  VERDICT_SHORTFALL: (
    s: Slots<
      | "depletionAge"
      | "shortfallYears"
      | "lifeExpectancy"
      | "sustainableMonthlyExpense"
      | "adjustmentPercent"
      | "adjustmentDirection"
    >,
  ) =>
    `Your plan runs short at age ${s.depletionAge}, ${s.shortfallYears} years before age ${s.lifeExpectancy}. Sustainable spending is ${s.sustainableMonthlyExpense} a month, ${s.adjustmentPercent} ${s.adjustmentDirection} plan.`,

  JOURNEY_HEADLINE_FUNDED: (s: Slots<"lifeExpectancy">) =>
    `Your money lasts to age ${s.lifeExpectancy}`,
  JOURNEY_HEADLINE_SHORT: (s: Slots<"depletionAge">) =>
    `Your money runs out at age ${s.depletionAge}`,
  JOURNEY_SHORTFALL: (
    s: Slots<"depletionAge" | "shortfallYears" | "lifeExpectancy">,
  ) =>
    `Your journey runs short at age ${s.depletionAge}, ${s.shortfallYears} years before age ${s.lifeExpectancy}.`,
  JOURNEY_STAGE_COUNT: (s: Slots<"count">) =>
    s.count === "1" ? "1 stage" : `${s.count} stages`,
  JOURNEY_STAGE_ASSUMPTIONS: (s: Slots<"equity" | "cash" | "inflation">) =>
    `equity ${s.equity}, cash ${s.cash}, inflation ${s.inflation}`,
  JOURNEY_STAGE_STANDALONE: () =>
    "Run as a plan on its own, from today. The journey above is the combined answer.",

  KPI_AT_AGE: (s: Slots<"age">) => `at age ${s.age}`,
  KPI_VS_PLANNED: (s: Slots<"delta" | "planned">) =>
    `${s.delta} vs planned ${s.planned}`,
  KPI_BEYOND_HORIZON: (s: Slots<"lifeExpectancy">) =>
    `beyond age ${s.lifeExpectancy}`,
  KPI_RUNWAY: (s: Slots<"years">) => `${s.years} years runway`,
  KPI_MC_RUNS: (s: Slots<"iterations" | "seed">) =>
    `${s.iterations} runs, seed ${s.seed}`,
  KPI_NOT_RUN: () => "not run",
  KPI_TARGET: (s: Slots<"target">) => `target ${s.target}`,

  STANDING_PROGRESS: (
    s: Slots<"fiProgress" | "fiNumber" | "fiAchievementAge">,
  ) =>
    `You have ${s.fiProgress} of your independence number of ${s.fiNumber}. At your planned contribution rate you reach it at age ${s.fiAchievementAge}.`,
  STANDING_PROGRESS_NO_AGE: (s: Slots<"fiProgress" | "fiNumber">) =>
    `You have ${s.fiProgress} of your independence number of ${s.fiNumber}.`,
  STANDING_COAST: (s: Slots<"fiProgress" | "fiNumber" | "retirementAge">) =>
    `You have ${s.fiProgress} of your independence number of ${s.fiNumber}. Your existing assets alone grow to it by age ${s.retirementAge}.`,

  MILESTONE_FI_AGE: (s: Slots<"age">) => `Independence at age ${s.age}.`,
  MILESTONE_PROPERTY_SOLD: (s: Slots<"age" | "amount">) =>
    `Property assumed sold at age ${s.age} releasing ${s.amount}.`,
  MILESTONE_CPF_LIFE: (s: Slots<"age">) =>
    `CPF LIFE payouts start at age ${s.age}.`,
  MILESTONE_PEAK_WEALTH: (s: Slots<"amount" | "age">) =>
    `Peak wealth ${s.amount} at age ${s.age}.`,

  STRESS_SUMMARY: (
    s: Slots<
      | "successRate"
      | "iterations"
      | "lifeExpectancy"
      | "terminalP10"
      | "terminalP50"
    >,
  ) =>
    `In ${s.successRate} of ${s.iterations} simulated markets the plan lasts to age ${s.lifeExpectancy}. The worst tenth of outcomes end with ${s.terminalP10}; the median with ${s.terminalP50}.`,
  STRESS_NO_DEPLETION: (s: Slots<"lifeExpectancy">) =>
    `No simulated path ran out of money before age ${s.lifeExpectancy}.`,

  INSIGHTS_EMPTY: () =>
    "No findings. The engine raised no flags for this plan.",
  SCENARIO_NONE: () => "Base plan, no scenario applied.",

  FOOTER: (s: Slots<"planName" | "asOfDate" | "templateVersion">) =>
    `${s.planName} · as of ${s.asOfDate} · report v${s.templateVersion}`,
  DISCLAIMER: () => "Projections are estimates, not advice.",
} as const

export type PhraseKey = keyof typeof phrases
