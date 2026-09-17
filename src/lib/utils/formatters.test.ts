import { formatCompact, formatCompactBare, formatDate } from "./formatters"

describe("formatDate", () => {
  // Locale decides ordering ("4 Aug 2026" vs "Aug 4, 2026"), so assert on the
  // parts rather than a fixed arrangement.
  const formatted = (dateString: string): string => formatDate(dateString)

  it("renders the calendar date named by a date-only string", () => {
    expect(formatted("2026-08-04")).toMatch(/Aug/)
    expect(formatted("2026-08-04")).toMatch(/4/)
    expect(formatted("2026-08-04")).toMatch(/2026/)
  })

  /**
   * `new Date("2026-08-04")` is midnight UTC, so west of UTC a naive
   * toLocaleDateString renders the 3rd. A "last checked" date must not report a
   * day early for anyone in the Americas.
   */
  it("does not shift a date-only string backwards in timezones west of UTC", () => {
    const inNewYork = formatDate("2026-08-04", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    })
    // An explicit timeZone option is honoured as the caller asked - so this one
    // does land on the 3rd. (Day-of-month asserted with a word boundary: locale
    // decides "Aug 3, 2026" vs "3 Aug 2026".)
    expect(inNewYork).toMatch(/Aug/)
    expect(inNewYork).toMatch(/\b3\b/)

    // ...but the default path pins date-only values to the calendar date.
    expect(formatted("2026-08-04")).toMatch(/\b4\b/)
    expect(formatted("2026-08-04")).not.toMatch(/\b3\b/)
  })

  it("leaves values that carry a time to be converted normally", () => {
    // Not date-only, so no UTC pinning - just assert it formats without throwing
    // and still names the right month and year.
    const result = formatDate("2026-08-04T12:00:00Z")
    expect(result).toMatch(/Aug/)
    expect(result).toMatch(/2026/)
  })
})

describe("formatCompact", () => {
  it("uses the currency it was given, not a bare dollar", () => {
    // A plan held in SGD was charted as "$2.14M", which reads as USD and
    // understates the figure by about a third.
    expect(formatCompact(2_140_000, "SGD")).toBe("S$2.14M")
    expect(formatCompact(180_000, "NZD")).toBe("NZ$180K")
    expect(formatCompact(950, "GBP")).toBe("£950")
  })

  it("falls back to a plain dollar with no currency", () => {
    expect(formatCompact(1_500_000)).toBe("$1.50M")
  })

  it("keeps the sign on negative amounts", () => {
    expect(formatCompact(-2_000_000, "SGD")).toBe("-S$2.00M")
    expect(formatCompact(-4_500, "SGD")).toBe("-S$5K")
  })

  it("switches scale at a million and a thousand", () => {
    expect(formatCompact(999_999, "USD")).toBe("$1000K")
    expect(formatCompact(1_000_000, "USD")).toBe("$1.00M")
    expect(formatCompact(999, "USD")).toBe("$999")
    expect(formatCompact(1_000, "USD")).toBe("$1K")
  })

  it("renders zero without a sign", () => {
    expect(formatCompact(0, "SGD")).toBe("S$0")
  })
})

describe("formatCompactBare", () => {
  it("drops the symbol — axis gridlines repeat it for nothing", () => {
    expect(formatCompactBare(2_140_000)).toBe("2.1M")
    expect(formatCompactBare(180_000)).toBe("180K")
    expect(formatCompactBare(950)).toBe("950")
    expect(formatCompactBare(-1_200_000)).toBe("-1.2M")
  })
})
