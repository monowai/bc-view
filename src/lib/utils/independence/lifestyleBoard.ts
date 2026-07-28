import { LifestyleCategory, LifestyleTier } from "types/independence"

/**
 * Pure logic for the Lifestyle Mood Board (ExpensesStep). Kept independent
 * of React so the greedy budget-fit algorithm, custom-amount detection and
 * lifestyle headline banding can be unit tested directly.
 *
 * Ported from bc-claude/playgrounds/lifestyle-mood-board.html.
 */

/** Map of category `key` -> selected tier index. */
export type TierSelection = Record<string, number>

/**
 * Upgrade priority weight for a category: higher sortOrder (lower
 * priority) categories get a proportionally smaller weight, mirroring the
 * playground's hand-tuned weights (housing highest, dining lowest) while
 * deriving purely from the catalog's own `sortOrder` — no hardcoded keys.
 */
function priorityWeight(
  category: LifestyleCategory,
  categories: LifestyleCategory[],
): number {
  const maxSortOrder = Math.max(...categories.map((c) => c.sortOrder))
  return maxSortOrder - category.sortOrder + 1
}

/** A tier is a "reserve" (5th, high-flyer) tier — deprioritised by the fitter. */
function isReserveTier(
  category: LifestyleCategory,
  tierIndex: number,
): boolean {
  return category.tiers[tierIndex]?.reserve === true
}

/**
 * Greedy budget-fit: start every category at its cheapest tier, then
 * repeatedly upgrade whichever single-step upgrade has the best
 * cost-per-priority score (delta / weight), applying a 3x penalty to
 * reserve-tier upgrades, until no further upgrade fits the budget.
 */
export function fitToBudget(
  categories: LifestyleCategory[],
  budget: number,
): TierSelection {
  const selection: TierSelection = {}
  categories.forEach((c) => {
    selection[c.key] = 0
  })

  let spent = categories.reduce((s, c) => s + c.tiers[0].monthlyAmount, 0)

  let improved = true
  while (improved) {
    improved = false
    const options = categories
      .filter((c) => selection[c.key] < c.tiers.length - 1)
      .map((c) => {
        const nextIdx = selection[c.key] + 1
        const delta =
          c.tiers[nextIdx].monthlyAmount -
          c.tiers[selection[c.key]].monthlyAmount
        const penalty = isReserveTier(c, nextIdx) ? 3 : 1
        const weight = priorityWeight(c, categories)
        return { key: c.key, delta, score: (delta / weight) * penalty }
      })
      .filter((o) => spent + o.delta <= budget)
      .sort((a, b) => a.score - b.score)

    if (options.length > 0) {
      selection[options[0].key] += 1
      spent += options[0].delta
      improved = true
    }
  }

  return selection
}

/** Monthly cost of a single category at the given selected tier index. */
export function categoryCost(
  category: LifestyleCategory,
  tierIndex: number,
): number {
  return category.tiers[tierIndex]?.monthlyAmount ?? 0
}

/**
 * Total monthly cost across categories using a tier-index picker function
 * — handy for computing floor ("cheapest tier everywhere") or ceiling
 * ("priciest tier everywhere") totals in tests without building a full
 * TierSelection map.
 */
export function categoryMonthlyTotal(
  categories: LifestyleCategory[],
  tierIndexFor: (category: LifestyleCategory) => number,
): number {
  return categories.reduce(
    (sum, c) => sum + categoryCost(c, tierIndexFor(c)),
    0,
  )
}

/** Total monthly cost across categories for a given TierSelection. */
export function boardMonthlyTotal(
  categories: LifestyleCategory[],
  selection: TierSelection,
): number {
  return categoryMonthlyTotal(categories, (c) => selection[c.key] ?? 0)
}

const HEADLINE_BANDS: Array<{ ceiling: number; label: string }> = [
  { ceiling: 4500, label: "Lean & Intentional" },
  { ceiling: 7000, label: "Simple Comforts" },
  { ceiling: 10500, label: "Comfortable" },
  { ceiling: 15000, label: "Premium" },
  { ceiling: 20000, label: "Luxurious" },
  { ceiling: 26000, label: "No Compromises" },
]

/** Lifestyle headline band for a given total monthly spend. */
export function lifestyleHeadline(monthlyTotal: number): string {
  const band = HEADLINE_BANDS.find((b) => monthlyTotal < b.ceiling)
  return band ? band.label : "High Flyer"
}

/**
 * True when a row's stored amount doesn't match its picked tier's anchor
 * — i.e. it was hand-edited via the Detailed tab.
 */
export function isCustomAmount(amount: number, tier: LifestyleTier): boolean {
  return amount !== tier.monthlyAmount
}

/** Index of the tier whose monthlyAmount is closest to `amount` (ties favour the lower/cheaper tier). */
export function nearestTierIndex(
  amount: number,
  tiers: LifestyleTier[],
): number {
  let bestIdx = 0
  let bestDistance = Infinity
  tiers.forEach((tier, idx) => {
    const distance = Math.abs(tier.monthlyAmount - amount)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIdx = idx
    }
  })
  return bestIdx
}
