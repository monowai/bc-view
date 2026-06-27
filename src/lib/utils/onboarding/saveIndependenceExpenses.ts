/**
 * Persists the onboarding retirement-expenses lump sum as a categorised
 * plan_expense row. The onboarding wizard collects a single "monthly expenses
 * in retirement" figure but previously only stored it on the plan total — no
 * `plan_expense` rows were written, so the categorised expense breakdown was
 * empty. This saves that lump sum under the shared "Other" category so the
 * plan opens with a real, editable expense line.
 *
 * Kept out of the wizard component so it can be unit-tested in isolation.
 */

import type { CategoryLabelsResponse } from "types/independence"

const OTHER_CATEGORY = "Other"
// resolveCategoryLabel (svc-retire) accepts any `custom-` prefixed id without a
// DB lookup, so this is a safe fallback if the seeded system label is absent.
const CUSTOM_OTHER_ID = "custom-other"

/**
 * @param planId           the just-created independence plan
 * @param monthlyExpenses  the onboarding lump-sum retirement expenses
 * @param currency         the plan's expense currency
 * @param fetchImpl        injectable for testing; defaults to global fetch
 */
export async function saveOnboardingExpenses(
  planId: string,
  monthlyExpenses: number,
  currency: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!planId || monthlyExpenses <= 0) return

  const categoryLabelId = await resolveOtherCategoryId(fetchImpl)

  const res = await fetchImpl(`/api/independence/plans/${planId}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      categoryLabelId,
      categoryName: OTHER_CATEGORY,
      monthlyAmount: monthlyExpenses,
      currency,
      expensePhase: "RETIREMENT",
    }),
  })

  // Surface a failed save rather than resolving silently — the caller logs it
  // so the expense isn't lost without a trace while the plan total succeeds.
  if (!res.ok) {
    throw new Error(`Failed to save onboarding expense: ${res.status}`)
  }
}

async function resolveOtherCategoryId(
  fetchImpl: typeof fetch,
): Promise<string> {
  try {
    const res = await fetchImpl("/api/independence/categories")
    if (res.ok) {
      const body = (await res.json()) as CategoryLabelsResponse
      const other = body.data?.find((c) => c.name === OTHER_CATEGORY)
      if (other) return other.id
    }
  } catch {
    // fall through to the custom fallback below
  }
  return CUSTOM_OTHER_ID
}
