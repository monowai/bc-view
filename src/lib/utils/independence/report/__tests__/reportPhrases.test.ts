import { isFindingCode } from "@lib/independence/report/reportPhrases"
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

  it("should reject an unknown code so the DTO title and detail are used", () => {
    expect(isFindingCode("SOMETHING_NEW")).toBe(false)
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
        adjustmentDirection: "below",
      }),
    ).toBe(
      "Your plan runs short at age 84, 6 years before age 90. Sustainable spending is S$7,900 a month, 6% below plan.",
    )
  })
})

describe("isFindingCode", () => {
  it("should accept a catalogued code and reject an unknown one", () => {
    expect(isFindingCode("ON_TRACK")).toBe(true)
    expect(isFindingCode("NOT_A_CODE")).toBe(false)
  })
})
