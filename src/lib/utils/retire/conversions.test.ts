import { toPercent, toDecimal, PERCENTAGE_FIELDS } from "./conversions"

describe("toPercent", () => {
  it("should convert decimal to percentage", () => {
    expect(toPercent(0.07, 0)).toBe(7)
    expect(toPercent(0.035, 0)).toBe(3.5)
    expect(toPercent(0.1, 0)).toBe(10)
    expect(toPercent(1, 0)).toBe(100)
  })

  it("should handle zero correctly", () => {
    expect(toPercent(0, 0)).toBe(0)
  })

  it("should use default value when input is undefined", () => {
    expect(toPercent(undefined, 0.07)).toBe(7)
    expect(toPercent(undefined, 0.035)).toBe(3.5)
  })

  it("should handle precision correctly", () => {
    // 0.0755 should round to 7.55%
    expect(toPercent(0.0755, 0)).toBe(7.55)
    // 0.07555 should round to 7.56%
    expect(toPercent(0.07555, 0)).toBe(7.56)
  })

  it("should handle small decimals", () => {
    expect(toPercent(0.001, 0)).toBe(0.1)
    expect(toPercent(0.0001, 0)).toBe(0.01)
  })

  it("should handle values greater than 1 (>100%)", () => {
    expect(toPercent(1.5, 0)).toBe(150)
    expect(toPercent(2, 0)).toBe(200)
  })

  it("should handle negative values", () => {
    expect(toPercent(-0.05, 0)).toBe(-5)
  })
})

describe("toDecimal", () => {
  it("should convert percentage to decimal", () => {
    expect(toDecimal(7)).toBe(0.07)
    expect(toDecimal(3.5)).toBe(0.035)
    expect(toDecimal(10)).toBe(0.1)
    expect(toDecimal(100)).toBe(1)
  })

  it("should handle zero correctly", () => {
    expect(toDecimal(0)).toBe(0)
  })

  it("should handle small percentages", () => {
    expect(toDecimal(0.1)).toBe(0.001)
    expect(toDecimal(0.01)).toBe(0.0001)
  })

  it("should handle values greater than 100%", () => {
    expect(toDecimal(150)).toBe(1.5)
    expect(toDecimal(200)).toBe(2)
  })

  it("should handle negative values", () => {
    expect(toDecimal(-5)).toBe(-0.05)
  })
})

describe("toPercent and toDecimal are inverses", () => {
  it("should be inverse operations for common values", () => {
    const testValues = [0.07, 0.035, 0.1, 0.025, 0.2, 0.6, 0.8, 1]

    testValues.forEach((decimal) => {
      const percent = toPercent(decimal, 0)
      const backToDecimal = toDecimal(percent)
      expect(backToDecimal).toBeCloseTo(decimal, 10)
    })
  })

  it("should be inverse operations for edge cases", () => {
    expect(toDecimal(toPercent(0, 0))).toBe(0)
    expect(toDecimal(toPercent(1, 0))).toBe(1)
  })
})

describe("PERCENTAGE_FIELDS", () => {
  it("should contain all expected fields", () => {
    expect(PERCENTAGE_FIELDS).toContain("cashReturnRate")
    expect(PERCENTAGE_FIELDS).toContain("equityReturnRate")
    expect(PERCENTAGE_FIELDS).toContain("housingReturnRate")
    expect(PERCENTAGE_FIELDS).toContain("inflationRate")
    expect(PERCENTAGE_FIELDS).toContain("cashAllocation")
    expect(PERCENTAGE_FIELDS).toContain("equityAllocation")
    expect(PERCENTAGE_FIELDS).toContain("housingAllocation")
    expect(PERCENTAGE_FIELDS).toContain("investmentAllocationPercent")
  })

  it("should have exactly 8 fields", () => {
    expect(PERCENTAGE_FIELDS).toHaveLength(8)
  })
})
