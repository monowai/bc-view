import {
  FINDING_CODES,
  findingPhrase,
  phrases,
} from "@lib/independence/report/reportPhrases"

describe("reportPhrases", () => {
  it("should have a phrase for every FindingsService code", () => {
    for (const code of FINDING_CODES) {
      expect(findingPhrase(code)).toBeDefined()
    }
  })

  it("should fall back to the DTO title and detail for an unknown code", () => {
    expect(findingPhrase("SOMETHING_NEW")).toBeUndefined()
  })

  it("should render the funded verdict with exact wording", () => {
    expect(
      phrases.VERDICT_FUNDED({
        lifeExpectancy: "90",
        terminalP50: "S$610,000",
      }),
    ).toBe(
      "Your plan funds every year to age 90 with S$610,000 to spare in the median case.",
    )
  })

  it("should render the shortfall verdict with exact wording", () => {
    expect(
      phrases.VERDICT_SHORTFALL({
        depletionAge: "84",
        shortfallYears: "6",
        lifeExpectancy: "90",
        sustainableMonthlyExpense: "S$7,900",
        adjustmentPercent: "6%",
      }),
    ).toBe(
      "Your plan runs short at age 84, 6 years before age 90. Sustainable spending is S$7,900 a month, 6% below plan.",
    )
  })
})
