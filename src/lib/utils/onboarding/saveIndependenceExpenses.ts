/**
 * Persists the onboarding retirement-expenses figures as categorised
 * `plan_expense` rows. The onboarding wizard collects a general living-cost
 * figure plus a separate healthcare/medical figure; without these rows the
 * categorised breakdown is empty AND the phased generator can't tell medical
 * (which ramps up with age) apart from discretionary spend (which tapers).
 *
 * Writes one row per positive amount: the general figure under "Other", the
 * medical figure under "Healthcare". Kept out of the wizard component so it can
 * be unit-tested in isolation.
 */

import type { CategoryLabelsResponse } from "types/independence"

const OTHER_CATEGORY = "Other"
const HEALTHCARE_CATEGORY = "Healthcare"
// resolveCategoryLabel (svc-retire) accepts any `custom-` prefixed id without a
// DB lookup, so these are safe fallbacks if the seeded system label is absent.
const CUSTOM_OTHER_ID = "custom-other"
const CUSTOM_HEALTHCARE_ID = "custom-healthcare"

/**
 * @param planId           the just-created independence plan
 * @param generalExpenses  monthly living costs excluding healthcare
 * @param medicalExpenses  monthly healthcare/medical costs (tracked separately)
 * @param currency         the plan's expense currency
 * @param fetchImpl        injectable for testing; defaults to global fetch
 */
export async function saveOnboardingExpenses(
  planId: string,
  generalExpenses: number,
  medicalExpenses: number,
  currency: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!planId || (generalExpenses <= 0 && medicalExpenses <= 0)) return

  // Resolve both category ids up front from the single categories fetch.
  const labels = await fetchCategoryLabels(fetchImpl)

  const rows: Array<{
    categoryLabelId: string
    categoryName: string
    amount: number
  }> = []
  if (generalExpenses > 0) {
    rows.push({
      categoryLabelId: resolveCategoryId(
        labels,
        OTHER_CATEGORY,
        CUSTOM_OTHER_ID,
      ),
      categoryName: OTHER_CATEGORY,
      amount: generalExpenses,
    })
  }
  if (medicalExpenses > 0) {
    rows.push({
      categoryLabelId: resolveCategoryId(
        labels,
        HEALTHCARE_CATEGORY,
        CUSTOM_HEALTHCARE_ID,
      ),
      categoryName: HEALTHCARE_CATEGORY,
      amount: medicalExpenses,
    })
  }

  for (const row of rows) {
    const res = await fetchImpl(`/api/independence/plans/${planId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryLabelId: row.categoryLabelId,
        categoryName: row.categoryName,
        monthlyAmount: row.amount,
        currency,
        expensePhase: "RETIREMENT",
      }),
    })

    // Surface a failed save rather than resolving silently — the caller logs it
    // so the expense isn't lost without a trace while the plan total succeeds.
    if (!res.ok) {
      throw new Error(
        `Failed to save onboarding expense (${row.categoryName}): ${res.status}`,
      )
    }
  }
}

async function fetchCategoryLabels(
  fetchImpl: typeof fetch,
): Promise<CategoryLabelsResponse["data"] | undefined> {
  try {
    const res = await fetchImpl("/api/independence/categories")
    if (res.ok) {
      const body = (await res.json()) as CategoryLabelsResponse
      return body.data
    }
  } catch {
    // fall through to the custom fallbacks
  }
  return undefined
}

function resolveCategoryId(
  labels: CategoryLabelsResponse["data"] | undefined,
  name: string,
  fallbackId: string,
): string {
  return labels?.find((c) => c.name === name)?.id ?? fallbackId
}
