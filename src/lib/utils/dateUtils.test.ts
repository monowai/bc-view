import { getDateOffset, getTodayDate } from "@lib/dateUtils"
import { todayIso } from "@lib/formatters"

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

describe("getTodayDate", () => {
  it('should return today\'s local date when input is "today"', () => {
    expect(getTodayDate("today")).toBe(ymd(new Date()))
  })

  it('should return the input date when input is not "today"', () => {
    const inputDate = "2023-10-01"
    expect(getTodayDate(inputDate)).toBe(inputDate)
  })

  it("should handle invalid date formats gracefully", () => {
    const invalidDate = "invalid-date"
    expect(getTodayDate(invalidDate)).toBe(invalidDate)
  })
})

describe("getDateOffset", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("returns today for offset 0", () => {
    expect(getDateOffset(0)).toBe(todayIso())
  })

  it("returns yesterday (t-1) for offset -1", () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(getDateOffset(-1)).toBe(ymd(d))
  })

  it("returns tomorrow (t+1) for offset +1", () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    expect(getDateOffset(1)).toBe(ymd(d))
  })

  it("rolls over month and year boundaries by local calendar", () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 11, 31, 23, 30))
    expect(getDateOffset(1)).toBe("2026-01-01")
    expect(getDateOffset(-31)).toBe("2025-11-30")
  })

  it("yields an ordered t-1 < t+1 default window", () => {
    // The Transactions page defaults its range to these.
    expect(getDateOffset(-1) < getDateOffset(1)).toBe(true)
  })

  it("formats as YYYY-MM-DD", () => {
    expect(getDateOffset(5)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
