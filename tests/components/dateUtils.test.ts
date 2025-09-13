// src/components/dateutils.test.ts

import { getTodayDate } from "@lib/dateUtils"

describe("getTodayDate", () => {
  it('should return today\'s date when input is "today"', () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const dd = String(today.getDate()).padStart(2, "0")
    const expectedDate = `${yyyy}-${mm}-${dd}`

    expect(getTodayDate("today")).toBe(expectedDate)
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
