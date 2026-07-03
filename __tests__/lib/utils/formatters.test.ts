/**
 * Tests for src/lib/utils/formatters.ts (main formatters) and
 * the independence re-exports (src/lib/utils/independence/formatters.ts).
 */

import {
  formatCurrency,
  formatCurrencySymbol,
  formatPercent,
  formatPercentValue,
  todayIso,
  toErrorMessage,
  gainLossClass,
} from "@lib/formatters"

import {
  formatCurrency as independenceFormatCurrency,
  formatPercent as independenceFormatPercent,
} from "@lib/independence/formatters"

describe("todayIso", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("toErrorMessage", () => {
  it("returns Error.message for Error instances", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom")
  })
  it("returns fallback for non-Error values", () => {
    expect(toErrorMessage("oops")).toBe("Unknown error")
  })
  it("respects a custom fallback", () => {
    expect(toErrorMessage(null, "custom fallback")).toBe("custom fallback")
  })
})

describe("gainLossClass", () => {
  it("returns text-green-600 for positive values", () => {
    expect(gainLossClass(1)).toBe("text-green-600")
  })
  it("returns text-green-600 for zero", () => {
    expect(gainLossClass(0)).toBe("text-green-600")
  })
  it("returns text-red-600 for negative values", () => {
    expect(gainLossClass(-1)).toBe("text-red-600")
  })
})

describe("formatCurrencySymbol", () => {
  it("formats with default $ symbol", () => {
    expect(formatCurrencySymbol(1234.5)).toBe("$1,234.5")
  })

  it("formats with a custom symbol", () => {
    expect(formatCurrencySymbol(100, "€")).toBe("€100")
  })

  it("formats zero", () => {
    expect(formatCurrencySymbol(0)).toBe("$0")
  })
})

describe("independence/formatters re-exports", () => {
  it("formatCurrency(100) → '$100'", () => {
    expect(independenceFormatCurrency(100)).toBe("$100")
  })

  it("formatPercent(7) → '7.0%'", () => {
    expect(independenceFormatPercent(7)).toBe("7.0%")
  })

  it("formatPercent with custom decimals", () => {
    expect(independenceFormatPercent(3.5, 2)).toBe("3.50%")
  })

  it("formatCurrency with custom symbol", () => {
    expect(independenceFormatCurrency(1234, "£")).toBe("£1,234")
  })
})

describe("main formatters (existing behaviour)", () => {
  it("formatCurrency formats with Intl (decimal)", () => {
    // Just check it produces a string with digits — locale-dependent
    const result = formatCurrency(1234.56)
    expect(result).toMatch(/1.234/)
  })

  it("formatPercent multiplies by 100", () => {
    expect(formatPercent(0.25)).toBe("25.00%")
  })

  it("formatPercentValue uses already-percent value", () => {
    expect(formatPercentValue(25)).toBe("25.0%")
    expect(formatPercentValue(7, 1)).toBe("7.0%")
  })
})
