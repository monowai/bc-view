import { reportSeed } from "@lib/independence/report/reportSeed"

describe("reportSeed", () => {
  it("should be stable for the same plan and as-of date", () => {
    expect(reportSeed("plan-1", "2026-09-28")).toBe(
      reportSeed("plan-1", "2026-09-28"),
    )
  })
  it("should differ when the as-of date changes", () => {
    expect(reportSeed("plan-1", "2026-09-28")).not.toBe(
      reportSeed("plan-1", "2026-09-29"),
    )
  })
  it("should be a positive 32-bit integer", () => {
    const s = reportSeed("plan-1", "2026-09-28")
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(2 ** 32)
  })
})
