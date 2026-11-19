import { spendSummary, trailingMonths } from "./spendSummary"
import type { PlanSpendEntry } from "types/independence"

const entry = (
  month: string,
  categoryLabelId: string,
  actual: number | null,
  projected: number | null = null,
): PlanSpendEntry => ({
  month,
  categoryLabelId,
  categoryName: categoryLabelId,
  projected,
  actual,
  currency: "SGD",
})

describe("trailingMonths", () => {
  it("lists the window ending in the current month, oldest first", () => {
    expect(trailingMonths(new Date(2026, 1, 15), 3)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ])
  })
})

describe("spendSummary", () => {
  const window = ["2026-09", "2026-10", "2026-11"]
  const budgets = { housing: 2000, travel: 1000 }

  it("totals actual spend over the months that have an actual", () => {
    const s = spendSummary(
      [
        entry("2026-09", "housing", 2000),
        entry("2026-09", "travel", 1500),
        entry("2026-10", "housing", 2000),
        entry("2026-11", "housing", null, 2100),
      ],
      budgets,
      36_000,
      window,
    )
    expect(s).toMatchObject({ monthsEntered: 2, actual: 5500, budget: 5000 })
  })

  it("compares a part-filled month only with the budget of the categories filled in", () => {
    // Travel left blank: housing on budget is on budget, not 1,000 under.
    const s = spendSummary(
      [entry("2026-09", "housing", 2000)],
      budgets,
      24_000,
      window,
    )
    expect(s).toMatchObject({ actual: 2000, budget: 2000, annualDraw: 24_000 })
  })

  it("counts spend in a category the plan has no budget for as all over budget", () => {
    const s = spendSummary(
      [entry("2026-09", "housing", 2000), entry("2026-09", "gifts", 300)],
      budgets,
      24_000,
      window,
    )
    expect(s).toMatchObject({ actual: 2300, budget: 2000 })
  })

  it("adds overspend against budget to the planned annual draw", () => {
    // 2 months entered, 3,000 over budget in total: 18,000 a year over.
    const s = spendSummary(
      [entry("2026-09", "housing", 3500), entry("2026-10", "housing", 3500)],
      budgets,
      36_000,
      window,
    )
    expect(s?.annualDraw).toBe(54_000)
  })

  it("never draws less than nothing when well under budget", () => {
    const s = spendSummary(
      [entry("2026-09", "housing", 100)],
      budgets,
      12_000,
      window,
    )
    expect(s?.annualDraw).toBe(0)
  })

  it("ignores months outside the window", () => {
    const s = spendSummary(
      [entry("2026-01", "housing", 9000), entry("2026-10", "housing", 3000)],
      budgets,
      36_000,
      window,
    )
    expect(s).toMatchObject({ monthsEntered: 1, actual: 3000 })
  })

  it("is null when no month in the window has an actual", () => {
    expect(
      spendSummary(
        [entry("2026-11", "housing", null, 2000)],
        budgets,
        0,
        window,
      ),
    ).toBeNull()
  })
})
