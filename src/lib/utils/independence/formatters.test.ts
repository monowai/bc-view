import { formatCurrency, formatPercent } from "./formatters"

describe("formatCurrency", () => {
  it("should format positive numbers with default $ symbol", () => {
    expect(formatCurrency(1000)).toBe("$1,000")
    expect(formatCurrency(1234567)).toBe("$1,234,567")
    expect(formatCurrency(100)).toBe("$100")
  })

  it("should handle zero", () => {
    expect(formatCurrency(0)).toBe("$0")
  })

  it("should handle decimal values", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56")
    expect(formatCurrency(0.99)).toBe("$0.99")
  })

  it("should handle negative values", () => {
    expect(formatCurrency(-1000)).toBe("$-1,000")
  })

  it("should use custom currency symbol", () => {
    expect(formatCurrency(1000, "€")).toBe("€1,000")
    expect(formatCurrency(1000, "£")).toBe("£1,000")
    expect(formatCurrency(1000, "NZD ")).toBe("NZD 1,000")
  })

  it("should handle large numbers", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000")
    expect(formatCurrency(999999999)).toBe("$999,999,999")
  })

  it("should handle small decimal values", () => {
    expect(formatCurrency(0.01)).toBe("$0.01")
    expect(formatCurrency(0.001)).toBe("$0.001")
  })
})

describe("formatPercent", () => {
  it("should format percentages with default 1 decimal place", () => {
    expect(formatPercent(7)).toBe("7.0%")
    expect(formatPercent(3.5)).toBe("3.5%")
    expect(formatPercent(10)).toBe("10.0%")
  })

  it("should handle zero", () => {
    expect(formatPercent(0)).toBe("0.0%")
  })

  it("should handle custom decimal places", () => {
    expect(formatPercent(7.555, 0)).toBe("8%")
    expect(formatPercent(7.555, 1)).toBe("7.6%")
    // Note: JavaScript's toFixed uses banker's rounding (round half to even)
    // 7.555.toFixed(2) = "7.55" due to IEEE 754 floating point representation
    expect(formatPercent(7.555, 2)).toBe("7.55%")
    expect(formatPercent(7.555, 3)).toBe("7.555%")
  })

  it("should handle negative values", () => {
    expect(formatPercent(-5)).toBe("-5.0%")
    expect(formatPercent(-2.5, 2)).toBe("-2.50%")
  })

  it("should handle values greater than 100", () => {
    expect(formatPercent(150)).toBe("150.0%")
    expect(formatPercent(200.5, 1)).toBe("200.5%")
  })

  it("should handle very small values", () => {
    expect(formatPercent(0.1)).toBe("0.1%")
    expect(formatPercent(0.01, 2)).toBe("0.01%")
  })

  it("should round correctly", () => {
    // Note: 7.55 in IEEE 754 is actually 7.549999... so rounds down
    expect(formatPercent(7.56, 1)).toBe("7.6%")
    expect(formatPercent(7.54, 1)).toBe("7.5%")
    expect(formatPercent(7.545, 2)).toBe("7.54%") // IEEE 754 rounding
  })
})
