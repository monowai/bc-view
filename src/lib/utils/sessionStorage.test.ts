import { getToday, getDateOffset } from "@lib/sessionStorage"

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

describe("getDateOffset", () => {
  it("returns today for offset 0", () => {
    expect(getDateOffset(0)).toBe(getToday())
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

  it("yields an ordered t-1 < t+1 default window", () => {
    // The Transactions page defaults its range to these.
    expect(getDateOffset(-1) < getDateOffset(1)).toBe(true)
  })

  it("formats as YYYY-MM-DD", () => {
    expect(getDateOffset(5)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
