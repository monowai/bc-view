import { formatSpendTick, spendHistory, OTHER_KEY } from "./spendHistory"
import type { SpendEntry } from "types/independence"

const entry = (
  month: string,
  categoryLabelId: string,
  actual: number | null,
  projected: number | null = null,
): SpendEntry => ({
  month,
  categoryLabelId,
  categoryName: categoryLabelId.toUpperCase(),
  projected,
  actual,
  currency: "SGD",
})

describe("spendHistory", () => {
  const months = ["2026-09", "2026-10", "2026-11"]
  const budgets = { a: 1000, b: 500 }

  it("gives one row per month, oldest first, with actual, budget and projected totals", () => {
    const h = spendHistory(
      [
        entry("2026-09", "a", 1200, 1000),
        entry("2026-09", "b", 400),
        entry("2026-10", "a", 900),
      ],
      budgets,
      months,
    )
    expect(h.rows.map((r) => r.month)).toEqual(months)
    expect(h.rows[0]).toMatchObject({
      actual: 1600,
      budget: 1500,
      projected: 1000,
    })
    // Only "a" recorded in October: compared with a's budget alone.
    expect(h.rows[1]).toMatchObject({ actual: 900, budget: 1000 })
  })

  it("leaves a month with nothing recorded empty rather than zero", () => {
    const h = spendHistory([entry("2026-09", "a", 1200)], budgets, months)
    expect(h.rows[2]).toMatchObject({
      actual: null,
      budget: null,
      projected: null,
    })
  })

  it("stacks the largest categories by total and folds the rest into Other", () => {
    const entries = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((c, i) =>
      entry("2026-09", c, (i + 1) * 100),
    )
    const h = spendHistory(entries, {}, months, 5)
    expect(h.series.map((s) => s.key)).toEqual([
      "c7",
      "c6",
      "c5",
      "c4",
      "c3",
      OTHER_KEY,
    ])
    // c1 + c2 = 300 folded into Other.
    expect(h.rows[0][OTHER_KEY]).toBe(300)
  })

  it("keeps a category's colour fixed by its rank over the whole window", () => {
    const h = spendHistory(
      [entry("2026-09", "a", 100), entry("2026-10", "b", 900)],
      budgets,
      months,
    )
    expect(h.series[0]).toMatchObject({ key: "b", name: "B" })
    expect(h.series[1]).toMatchObject({ key: "a", name: "A" })
    expect(h.series[0].color).not.toBe(h.series[1].color)
  })

  it("has no series when nothing is recorded", () => {
    expect(spendHistory([], budgets, months).series).toEqual([])
  })

  it("starts at the first recorded month, showing at least six months", () => {
    const year = Array.from(
      { length: 11 },
      (_, i) => `2026-${String(i + 1).padStart(2, "0")}`,
    )
    const late = spendHistory([entry("2026-10", "a", 100)], budgets, year)
    expect(late.rows.map((r) => r.month)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ])
    const early = spendHistory([entry("2026-02", "a", 100)], budgets, year)
    expect(early.rows[0].month).toBe("2026-02")
  })
})

describe("formatSpendTick", () => {
  it("keeps the half-thousands a compact axis would round away", () => {
    expect(formatSpendTick(0)).toBe("0")
    expect(formatSpendTick(1500)).toBe("1.5K")
    expect(formatSpendTick(3000)).toBe("3K")
    expect(formatSpendTick(450)).toBe("450")
  })
})
