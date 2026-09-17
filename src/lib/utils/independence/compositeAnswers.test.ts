import { compositeAnswers } from "@lib/independence/compositeAnswers"
import type { CompositeProjectionResult } from "types/independence"

const row = (age: number, endingBalance: number): { age: number } =>
  ({ age, endingBalance }) as never

const projection = (
  overrides: Partial<CompositeProjectionResult> = {},
): CompositeProjectionResult =>
  ({
    asOfDate: "2026-09-17",
    displayCurrency: "SGD",
    phases: [],
    totalAssets: 0,
    liquidAssets: 500_000,
    fiNumber: 1_000_000,
    runwayYears: 30,
    isSustainable: true,
    yearlyProjections: [
      row(61, 600_000),
      row(62, 900_000),
      row(63, 1_100_000),
      row(64, 1_300_000),
    ],
    warnings: [],
    ...overrides,
  }) as CompositeProjectionResult

describe("compositeAnswers", () => {
  it("says nothing without a projection", () => {
    expect(compositeAnswers(undefined, 60)).toBeNull()
  })

  it("finds the first age the balance reaches the FI number", () => {
    const a = compositeAnswers(projection(), 60)!
    expect(a.fiCrossingAge).toBe(63)
    expect(a.yearsToFi).toBe(3)
  })

  it("reports the gap to FI, and a surplus as a negative gap", () => {
    expect(compositeAnswers(projection(), 60)!.gap).toBe(500_000)
    expect(compositeAnswers(projection(), 60)!.isAchieved).toBe(false)

    const rich = compositeAnswers(projection({ liquidAssets: 1_200_000 }), 60)!
    expect(rich.gap).toBe(-200_000)
    expect(rich.isAchieved).toBe(true)
  })

  it("flags a trajectory that falls back under the FI line", () => {
    // "FI at 63" on its own would be a half-truth if the money dips back
    // below the target later — the page has to be able to say so.
    const a = compositeAnswers(
      projection({
        yearlyProjections: [
          row(61, 600_000),
          row(62, 1_100_000),
          row(63, 800_000),
        ] as never,
      }),
      60,
    )!
    expect(a.fiCrossingAge).toBe(62)
    expect(a.dipsBelow).toBe(true)
  })

  it("does not claim a crossing when the balance never gets there", () => {
    const a = compositeAnswers(
      projection({
        yearlyProjections: [row(61, 100), row(62, 200)] as never,
      }),
      60,
    )!
    expect(a.fiCrossingAge).toBeNull()
    expect(a.yearsToFi).toBeNull()
    expect(a.dipsBelow).toBe(false)
  })

  it("stays quiet when the backend sent no FI number", () => {
    // Older svc-retire responses omit fiNumber. Deriving a crossing against
    // zero would mark age 61 as "FI achieved" on every plan.
    const a = compositeAnswers(projection({ fiNumber: undefined }), 60)!
    expect(a.fiNumber).toBe(0)
    expect(a.fiCrossingAge).toBeNull()
    expect(a.isAchieved).toBe(false)
  })

  it("has no years-to-FI without a current age", () => {
    const a = compositeAnswers(projection(), undefined)!
    expect(a.fiCrossingAge).toBe(63)
    expect(a.yearsToFi).toBeNull()
  })
})
