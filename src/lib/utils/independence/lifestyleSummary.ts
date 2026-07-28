import type {
  CategoryLabel,
  LifestyleCatalogResponse,
  PlanExpense,
  RetirementProjection,
} from "types/independence"
import { tierLevelFor, type TierLevel } from "@lib/independence/lifestyleTiers"

/**
 * Turns a plan's expense mix plus the backend's sustainable-spend figures into
 * the "what your plan supports" read.
 *
 * The totals are NEVER derived here — `sustainableMonthlyExpense` and
 * `expenseAdjustmentPercent` come off the projection exactly as svc-retire
 * calculated them. All this module does is distribute that total across the
 * categories the user described, so the number becomes a lifestyle rather than
 * a lump sum.
 */

/** Below this the adjustment is noise, not a message worth showing. */
const LEVEL_THRESHOLD_PERCENT = 1

/** Share of described spend at which one category defines the whole mix. */
const DOMINANT_SHARE = 0.45
/** Share at which a category is worth naming, but isn't the whole story. */
const HEAVY_SHARE = 0.2

export const ROLLUP_LABEL = "Everything else"

/**
 * How the plan feels to live on, from challenging to luxury.
 *
 * This is a SUMMARY OF THE BREAKDOWN, not a restatement of the headroom. Each
 * category sits on its own ladder — S$750 of healthcare is rung 3 of 4 — and
 * the overall read is those rungs averaged, weighted by what each category
 * costs. So a plan whose housing and food are near the top of their ladders
 * reads as generous even if it happens to spend exactly what was described,
 * and a plan with headroom over a frugal life still reads as tight.
 *
 * Anchored, therefore, to svc-retire's lifestyle catalog rather than to the
 * user's own expectations. Categories with no ladder — a custom
 * category, an unsupported currency — are left out of the average entirely,
 * because scoring them as zero would drag every plan down for the crime of
 * having a category we haven't described.
 */
export const COMFORT_STEPS = [
  "challenging",
  "tight",
  "comfortable",
  "generous",
  "luxury",
] as const

export type ComfortKey = (typeof COMFORT_STEPS)[number]

export const COMFORT_SCALE_MAX = 10

export interface ComfortBand {
  key: ComfortKey
  label: string
  /** 1-based position among the five named bands. */
  step: number
  /** 1–10. Finer than the band, so movement inside one is still visible. */
  score: number
  /** How many categories the average is over — the read is thin below ~3. */
  basedOn: number
}

const COMFORT_LABELS: Record<ComfortKey, string> = {
  challenging: "Challenging",
  tight: "Tight",
  comfortable: "Comfortable",
  generous: "Generous",
  luxury: "Luxury",
}

/** Two score points per band, so the number and the word can never disagree. */
function keyForScore(score: number): ComfortKey {
  return COMFORT_STEPS[Math.min(4, Math.floor((score - 1) / 2))]
}

interface Weighted {
  amount: number
  level: TierLevel | null
}

/**
 * Weighted by spend: what a plan mostly pays for should mostly decide how it
 * reads. An extravagant pet budget shouldn't outvote modest housing.
 */
export function comfortFromBreakdown(entries: Weighted[]): ComfortBand | null {
  const scored = entries.filter((e) => e.level && e.amount > 0)
  const weight = scored.reduce((sum, e) => sum + e.amount, 0)
  if (scored.length === 0 || weight <= 0) return null

  const position =
    scored.reduce((sum, e) => {
      const { index, of } = e.level!
      // Rung 1 of 4 → 0, rung 4 of 4 → 1.
      return sum + e.amount * ((index - 1) / Math.max(1, of - 1))
    }, 0) / weight

  const score = Math.min(
    COMFORT_SCALE_MAX,
    Math.max(1, Math.round(1 + position * (COMFORT_SCALE_MAX - 1))),
  )
  const key = keyForScore(score)
  return {
    key,
    label: COMFORT_LABELS[key],
    step: COMFORT_STEPS.indexOf(key) + 1,
    score,
    basedOn: scored.length,
  }
}

/**
 * Coarse quantities, because "0.63 of your Entertainment budget" is a number
 * and "two-thirds of an Entertainment budget" is a thought.
 *
 * Each entry is a complete quantity phrase, plural included. Composing them
 * from parts is what produced "your whole your Ruby budget" — and "a" rather
 * than "your" keeps it readable when the category is a person's name: "a whole
 * Ruby budget" works, "your whole Ruby budget" reads like an accusation.
 */
const QUANTITIES: Array<[ratio: number, phrase: (category: string) => string]> =
  [
    [0.25, (c) => `a quarter of ${aOrAn(c)} budget`],
    [0.33, (c) => `a third of ${aOrAn(c)} budget`],
    [0.5, (c) => `half ${aOrAn(c)} budget`],
    [0.67, (c) => `two-thirds of ${aOrAn(c)} budget`],
    [0.75, (c) => `three-quarters of ${aOrAn(c)} budget`],
    [1, (c) => `a whole ${c} budget`],
    [1.5, (c) => `one and a half ${c} budgets`],
    [2, (c) => `two ${c} budgets`],
    [3, (c) => `three ${c} budgets`],
  ]

/**
 * "an Entertainment budget", "a Utilities budget". Deliberately excludes "u":
 * the letter is a vowel but the sound usually isn't, and category names that
 * start with one — Utilities — take "a".
 */
function aOrAn(word: string): string {
  return /^[aeio]/i.test(word.trim()) ? `an ${word}` : `a ${word}`
}

/** Below this the gap isn't worth a sentence — it's the same life. */
const NEGLIGIBLE_SHARE = 0.02

function nearestQuantity(ratio: number, category: string): string {
  const [, phrase] = QUANTITIES.reduce((best, entry) =>
    Math.abs(entry[0] - ratio) < Math.abs(best[0] - ratio) ? entry : best,
  )
  return phrase(category)
}

/**
 * Says what the gap between supported and described spend is *worth*, in terms
 * of something the user named themselves.
 *
 * This is what makes the comfort band mean anything without inventing external
 * benchmarks: "two-thirds of your Entertainment budget spare" is arithmetic on
 * the user's own figures, and it lands as a lifestyle statement rather than a
 * financial one. Returns null when there's no named category to measure
 * against — the rolled-up remainder is not a thing anyone recognises as theirs.
 */
export function headroomPhrase(
  model: Pick<
    LifestyleSummaryModel,
    "monthlyTotal" | "describedMonthly" | "categories"
  >,
): string | null {
  const surplus = model.monthlyTotal - model.describedMonthly
  if (model.describedMonthly <= 0) return null
  if (Math.abs(surplus) / model.describedMonthly < NEGLIGIBLE_SHARE) {
    return "just about exactly the life you described"
  }

  const named = model.categories.filter((c) => !c.isRollup && c.described > 0)
  if (named.length === 0) return null

  // The category whose own budget is closest in size to the gap — that's the
  // one that makes the comparison land.
  const magnitude = Math.abs(surplus)
  const reference = named.reduce((best, c) =>
    Math.abs(c.described - magnitude) < Math.abs(best.described - magnitude)
      ? c
      : best,
  )
  const quantity = nearestQuantity(
    magnitude / reference.described,
    reference.categoryName,
  )

  // Both read as complete sentences once capitalised by the caller. The
  // shortfall used to be a bare noun phrase — "Your whole Ruby budget more than
  // the plan can cover." — which stated a comparison without ever making it.
  return surplus > 0
    ? `everything you planned for, and about ${quantity} spare`
    : `the plan falls short by about ${quantity}`
}

export interface LifestyleCategory {
  categoryName: string
  /** Catalog id, for looking the category's tiers up. */
  categoryLabelId: string
  /** Catalog emoji for the tile. Absent for a user's own category. */
  emoji?: string
  /** What this level of spend buys, in this market — "health insurance + gym".
   *  Absent where no band is authored; see lifestyleBenchmarks. */
  benchmark?: string
  /** The backend's own words for what the bucket covers — "Medical, dental,
   *  vision, insurance". Shown only when there's no benchmark to show instead. */
  description?: string
  /** Monthly amount the user entered. */
  described: number
  /** The amount rendered: scaled to what the plan supports, or the
   *  described amount itself when `basis` is "described". */
  amount: number
  /** 0–1, relative to the largest category — the bar's width. */
  share: number
  /** True for the rolled-up remainder row. */
  isRollup: boolean
}

export type LifestyleDirection = "headroom" | "shortfall" | "level"

/**
 * What the figures mean.
 *
 * - `supported` — the backend's sustainable spend, spread across categories.
 *   Makes an affordability claim.
 * - `described` — only what the user said they'd spend. Makes NO claim about
 *   whether the plan can afford it. Used where the backend has no sustainable
 *   figure to give (composite/phased projections), so that the absence of an
 *   answer never gets rendered as one.
 */
export type LifestyleBasis = "supported" | "described"

export interface LifestyleSummaryModel {
  basis: LifestyleBasis
  /** The headline: sustainable monthly spend, or the described total. */
  monthlyTotal: number
  /** Sum of what the user entered. */
  describedMonthly: number
  /** Backend's adjustment: positive = room to spend more. Null when absent. */
  adjustmentPercent: number | null
  direction: LifestyleDirection
  categories: LifestyleCategory[]
  /** e.g. "Travel-heavy", "Housing-dominant", "Balanced". Null when unknowable. */
  mixDescriptor: string | null
  /** Present only when selling illiquid assets lifts the sustainable figure. */
  liquidation: { supportedMonthly: number; fromAge: number | null } | null
  /** Comfort relative to the described life. Null on the described basis,
   *  where there is no projection to compare against. */
  comfort: ComfortBand | null
}

interface BuildArgs {
  expenses: PlanExpense[] | undefined
  projection: RetirementProjection | null | undefined
  /** Category definitions, for their descriptions. Optional: without them the
   *  board still works, it just says less. */
  labels?: CategoryLabel[]
  /** svc-retire's tier catalog, already converted to the plan's currency. */
  catalog?: LifestyleCatalogResponse
  /** Categories shown before the rest roll up. */
  maxCategories?: number
}

/**
 * Returns null when there's nothing honest to say — no expenses described, or
 * no sustainable figure from the backend. Callers render the mirror or empty
 * variant in that case rather than inventing a number.
 */
export function buildLifestyleSummary({
  expenses,
  projection,
  labels,
  catalog,
  maxCategories = 5,
}: BuildArgs): LifestyleSummaryModel | null {
  const described = (expenses ?? []).filter((e) => (e.monthlyAmount || 0) > 0)
  const describedMonthly = described.reduce(
    (sum, e) => sum + e.monthlyAmount,
    0,
  )
  const supportedMonthly = projection?.sustainableMonthlyExpense

  if (described.length === 0 || describedMonthly <= 0) return null
  if (supportedMonthly == null || supportedMonthly < 0) return null

  const ranked = [...described].sort(
    (a, b) => b.monthlyAmount - a.monthlyAmount,
  )
  const grouped = rollUp(ranked, maxCategories, labels)
  const categories = allocate(grouped, describedMonthly, supportedMonthly)
  const largest = Math.max(...categories.map((c) => c.amount), 0)
  // Banded on the SUPPORTED amount: describing the figure the user typed
  // would label a life their plan may not actually pay for.
  const withBenchmarks = categories.map((c) => {
    const level = tierLevelFor(c.categoryLabelId, c.amount, catalog)
    return { ...c, level, benchmark: level?.descriptor, emoji: level?.emoji }
  })

  return {
    basis: "supported",
    monthlyTotal: supportedMonthly,
    describedMonthly,
    adjustmentPercent: projection?.expenseAdjustmentPercent ?? null,
    direction: toDirection(projection?.expenseAdjustmentPercent),
    categories: withBenchmarks.map((c) => ({
      ...c,
      share: largest > 0 ? c.amount / largest : 0,
    })),
    mixDescriptor: describeMix(ranked, describedMonthly),
    liquidation: toLiquidation(projection, supportedMonthly),
    comfort: comfortFromBreakdown(withBenchmarks),
  }
}

/**
 * The spending shape alone, with no affordability claim attached.
 *
 * For surfaces where the backend has no sustainable figure to give — a
 * composite/phased projection returns none — this shows what the user
 * described and stops there. The alternative would be deriving a sustainable
 * number from one phase and presenting it as the whole plan's, which is
 * exactly the invention this codebase forbids.
 */
export function buildExpenseMix({
  expenses,
  labels,
  catalog,
  maxCategories = 5,
}: {
  expenses: PlanExpense[] | undefined
  labels?: CategoryLabel[]
  catalog?: LifestyleCatalogResponse
  maxCategories?: number
}): LifestyleSummaryModel | null {
  const described = (expenses ?? []).filter((e) => (e.monthlyAmount || 0) > 0)
  const describedMonthly = described.reduce(
    (sum, e) => sum + e.monthlyAmount,
    0,
  )
  if (described.length === 0 || describedMonthly <= 0) return null

  const ranked = [...described].sort(
    (a, b) => b.monthlyAmount - a.monthlyAmount,
  )
  const grouped = rollUp(ranked, maxCategories, labels)
  const largest = Math.max(...grouped.map((g) => g.described), 0)
  const mixWithBenchmarks = grouped.map((g) => {
    const level = tierLevelFor(g.categoryLabelId, g.described, catalog)
    return {
      ...g,
      amount: g.described,
      level,
      benchmark: level?.descriptor,
      emoji: level?.emoji,
    }
  })

  return {
    basis: "described",
    monthlyTotal: describedMonthly,
    describedMonthly,
    adjustmentPercent: null,
    direction: "level",
    categories: mixWithBenchmarks.map((g) => ({
      ...g,
      share: largest > 0 ? g.amount / largest : 0,
    })),
    mixDescriptor: describeMix(ranked, describedMonthly),
    liquidation: null,
    // A lifestyle read, not an affordability one — it needs no projection, so
    // composite phases get it too.
    comfort: comfortFromBreakdown(mixWithBenchmarks),
  }
}

interface Grouped {
  categoryName: string
  categoryLabelId: string
  description?: string
  described: number
  isRollup: boolean
}

/** Top N by amount, with the tail collapsed into a single row. */
function rollUp(
  ranked: PlanExpense[],
  maxCategories: number,
  labels: CategoryLabel[] | undefined,
): Grouped[] {
  const describe = new Map(
    (labels ?? []).map((l) => [l.id, l.description?.trim() || undefined]),
  )
  const head: Grouped[] = ranked.slice(0, maxCategories).map((e) => ({
    categoryName: e.categoryName,
    categoryLabelId: e.categoryLabelId,
    description: describe.get(e.categoryLabelId),
    described: e.monthlyAmount,
    isRollup: false,
  }))
  const tail = ranked.slice(maxCategories)
  if (tail.length === 0) return head
  return [
    ...head,
    {
      categoryName: ROLLUP_LABEL,
      // The remainder spans categories, so it matches no single tier ladder.
      categoryLabelId: "",
      // It describes itself best by naming what it swallowed.
      description: tail.map((e) => e.categoryName).join(", "),
      described: tail.reduce((sum, e) => sum + e.monthlyAmount, 0),
      isRollup: true,
    },
  ]
}

/**
 * Scales each category by supported/described. The last row absorbs the
 * rounding drift so the rows always add up to the supported total — a
 * breakdown that doesn't sum to its own headline destroys trust faster than
 * any amount of imprecision.
 */
function allocate(
  groups: Grouped[],
  describedMonthly: number,
  supportedMonthly: number,
): Omit<LifestyleCategory, "share">[] {
  const ratio = describedMonthly > 0 ? supportedMonthly / describedMonthly : 0
  const scaled = groups.map((g) => ({
    ...g,
    amount: Math.round(g.described * ratio),
  }))
  const drift = Math.round(supportedMonthly) - sum(scaled.map((s) => s.amount))
  const last = scaled[scaled.length - 1]
  if (last) last.amount = Math.max(0, last.amount + drift)
  return scaled
}

function toDirection(
  adjustmentPercent: number | undefined,
): LifestyleDirection {
  if (adjustmentPercent == null) return "level"
  if (adjustmentPercent > LEVEL_THRESHOLD_PERCENT) return "headroom"
  if (adjustmentPercent < -LEVEL_THRESHOLD_PERCENT) return "shortfall"
  return "level"
}

/**
 * Names the shape of the user's OWN mix. Deliberately says nothing about how
 * many holidays the money buys: the backend supplies no lifestyle benchmarks,
 * and inventing them here would be fiction dressed as advice.
 */
function describeMix(
  ranked: PlanExpense[],
  describedMonthly: number,
): string | null {
  const top = ranked[0]
  if (!top || describedMonthly <= 0) return null
  const share = top.monthlyAmount / describedMonthly
  const name = top.categoryName.trim()
  if (!name) return null
  if (share >= DOMINANT_SHARE) return `${name}-dominant`
  if (share >= HEAVY_SHARE) return `${name}-heavy`
  return "Balanced"
}

function toLiquidation(
  projection: RetirementProjection | null | undefined,
  supportedMonthly: number,
): LifestyleSummaryModel["liquidation"] {
  const withLiquidation = projection?.sustainableWithLiquidation
  if (withLiquidation == null || withLiquidation <= supportedMonthly)
    return null
  return {
    supportedMonthly: withLiquidation,
    fromAge: projection?.liquidationAge ?? null,
  }
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0)
}
