import { compositeOutlook } from "@lib/independence/compositeOutlook"
import type { CompositeProjectionResult } from "types/independence"

const projection = (
  overrides: Partial<CompositeProjectionResult> = {},
): CompositeProjectionResult =>
  ({
    asOfDate: "2026-07-28",
    displayCurrency: "SGD",
    phases: [],
    totalAssets: 0,
    liquidAssets: 0,
    runwayYears: 30,
    isSustainable: true,
    yearlyProjections: [{ age: 88 }, { age: 89 }, { age: 90 }],
    warnings: [],
    ...overrides,
  }) as CompositeProjectionResult

describe("compositeOutlook", () => {
  it("reads the end age off the last projected year", () => {
    const outlook = compositeOutlook(projection())!
    expect(outlook.sustainable).toBe(true)
    expect(outlook.age).toBe(90)
    expect(outlook.badge).toBe("Sustainable to age 90")
    expect(outlook.statement).toBe(
      "Your phases hold together — the money lasts to age 90.",
    )
  })

  it("names the age the money runs out", () => {
    const outlook = compositeOutlook(
      projection({ isSustainable: false, depletionAge: 78 }),
    )!
    expect(outlook.sustainable).toBe(false)
    expect(outlook.age).toBe(78)
    expect(outlook.badge).toBe("Savings deplete at age 78")
    expect(outlook.statement).toBe("These phases run out of money at age 78.")
  })

  it("still says something useful without an age", () => {
    const sustainable = compositeOutlook(projection({ yearlyProjections: [] }))!
    expect(sustainable.badge).toBe("Sustainable to age ?")
    expect(sustainable.statement).toBe("Your phases hold together.")

    const depleting = compositeOutlook(
      projection({ isSustainable: false, depletionAge: undefined }),
    )!
    expect(depleting.statement).toBe(
      "These phases run out of money before the end of the plan.",
    )
  })

  it("says nothing without a projection", () => {
    expect(compositeOutlook(undefined)).toBeNull()
  })

  it("keeps the badge and the statement agreeing", () => {
    // They render in two places — the tab bar and the Summary header — and a
    // second copy of this logic would eventually contradict the first.
    for (const sustainable of [true, false]) {
      const outlook = compositeOutlook(
        projection({ isSustainable: sustainable, depletionAge: 78 }),
      )!
      expect(outlook.sustainable).toBe(sustainable)
      expect(outlook.badge.includes("Sustainable")).toBe(sustainable)
    }
  })
})
