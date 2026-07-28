import type { CompositeProjectionResult } from "types/independence"

/**
 * Whether a phased plan holds together, in the two forms the UI needs.
 *
 * Extracted so the tab-bar badge and the Summary header can't drift apart:
 * they are the same claim about the same projection, and two copies of
 * "sustainable to age N" would eventually disagree.
 *
 * This is the only affordability statement a composite can honestly make.
 * `CompositeProjectionResult` returns no sustainable-spend figure, so there is
 * nothing to scale the phase breakdowns against — what it does know is whether
 * the money lasts, and until when.
 */
export interface CompositeOutlook {
  sustainable: boolean
  /** Age the money lasts to, or the age it runs out. Null when unknowable. */
  age: number | null
  /** Terse, for the tab bar. */
  badge: string
  /** A sentence, for the Summary header. */
  statement: string
}

export function compositeOutlook(
  projection: CompositeProjectionResult | undefined,
): CompositeOutlook | null {
  if (!projection) return null

  if (projection.isSustainable) {
    const rows = projection.yearlyProjections
    const age = rows?.[rows.length - 1]?.age ?? null
    return {
      sustainable: true,
      age,
      badge: `Sustainable to age ${age ?? "?"}`,
      statement:
        age != null
          ? `Your phases hold together — the money lasts to age ${age}.`
          : "Your phases hold together.",
    }
  }

  const age = projection.depletionAge ?? null
  return {
    sustainable: false,
    age,
    badge: `Savings deplete at age ${age ?? "?"}`,
    statement:
      age != null
        ? `These phases run out of money at age ${age}.`
        : "These phases run out of money before the end of the plan.",
  }
}
