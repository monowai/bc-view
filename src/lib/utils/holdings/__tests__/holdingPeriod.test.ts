import { holdingYears, formatHoldingPeriod } from "@lib/holdings/holdingPeriod"

const NOW = new Date("2024-07-01T00:00:00Z")

describe("holdingPeriod", () => {
  describe("holdingYears", () => {
    it("returns undefined when no open date", () => {
      expect(holdingYears(undefined, NOW)).toBeUndefined()
    })

    it("returns the elapsed years from the open date", () => {
      // 2022-07-01 → 2024-07-01 ≈ 2 years
      expect(holdingYears("2022-07-01", NOW)).toBeCloseTo(2, 1)
    })

    it("returns undefined for an invalid date string (no NaN leak)", () => {
      expect(holdingYears("not-a-date", NOW)).toBeUndefined()
      expect(holdingYears("2024-99-99", NOW)).toBeUndefined()
    })
  })

  describe("formatHoldingPeriod", () => {
    it("is empty when no open date", () => {
      expect(formatHoldingPeriod(undefined, NOW)).toBe("")
    })

    it("is empty for an invalid date string (no 'NaNy')", () => {
      expect(formatHoldingPeriod("not-a-date", NOW)).toBe("")
    })

    it("renders whole months under a year", () => {
      // 2024-01-01 → 2024-07-01 ≈ 5.98 months → floored to 5m
      expect(formatHoldingPeriod("2024-01-01", NOW)).toBe("5m")
    })

    it("renders one-decimal years from a year and over", () => {
      // 2022-01-01 → 2024-07-01 ≈ 2.5 years
      expect(formatHoldingPeriod("2022-01-01", NOW)).toBe("2.5y")
    })
  })
})
