import type {
  LifestyleCatalogResponse,
  LifestyleTier,
} from "types/independence"

/**
 * Where a spend sits on its category's tier ladder, per the svc-retire
 * catalog.
 *
 * This replaces a hard-coded band table that used to live in the frontend.
 * The catalog is the single source: svc-retire owns the amounts, converts
 * them to the plan's currency and caches them, so the summary surfaces and
 * the mood board describe the same life with the same words.
 */
export interface TierLevel {
  /** What this level of spend buys — "health insurance + gym". */
  descriptor: string
  /** Category emoji, for the mood board tile. */
  emoji: string
  /** 1-based rung. */
  index: number
  /** Rungs on this ladder, so callers can normalise. */
  of: number
}

/** Nearest tier by amount — the catalog's own matching rule. */
function nearestTierIndex(amount: number, tiers: LifestyleTier[]): number {
  let best = 0
  let bestDistance = Infinity
  tiers.forEach((tier, index) => {
    const distance = Math.abs(tier.monthlyAmount - amount)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

/**
 * Looks up by `categoryLabelId` — the catalog carries the same id the plan's
 * expenses do, so this never has to guess from a category's name. Returns null
 * for anything the catalog doesn't cover: a user's own category, or a catalog
 * that hasn't loaded.
 */
export function tierLevelFor(
  categoryLabelId: string,
  amount: number,
  catalog: LifestyleCatalogResponse | undefined,
): TierLevel | null {
  if (!catalog || amount <= 0) return null
  const category = catalog.categories.find(
    (c) => c.categoryLabelId === categoryLabelId,
  )
  if (!category?.tiers.length) return null
  const index = nearestTierIndex(amount, category.tiers)
  const tier = category.tiers[index]
  return {
    descriptor: tier.description,
    emoji: tier.emoji || category.emoji,
    index: index + 1,
    of: category.tiers.length,
  }
}
