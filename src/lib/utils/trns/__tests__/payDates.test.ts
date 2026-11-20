import { nextPayDate, payDay } from "@utils/trns/payDates"

describe("nextPayDate", () => {
  it("is the same day next month", () => {
    expect(nextPayDate("2026-08-25", 25)).toBe("2026-09-25")
  })

  it("rolls December into January", () => {
    expect(nextPayDate("2026-12-25", 25)).toBe("2027-01-25")
  })

  it("moves to the last day of a shorter month", () => {
    expect(nextPayDate("2027-01-31", 31)).toBe("2027-02-28")
    expect(nextPayDate("2028-01-31", 31)).toBe("2028-02-29")
    expect(nextPayDate("2026-10-31", 31)).toBe("2026-11-30")
  })

  it("returns to the pay day after a shorter month", () => {
    expect(nextPayDate("2027-02-28", 31)).toBe("2027-03-31")
  })
})

describe("payDay", () => {
  it("reads the day of month from an ISO date", () => {
    expect(payDay("2026-08-07")).toBe(7)
  })

  it("is 0 for an empty date", () => {
    expect(payDay("")).toBe(0)
  })
})
