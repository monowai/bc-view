import { buildBrokerageFunding } from "../buildBrokerageFunding"

describe("buildBrokerageFunding", () => {
  it("opens one zero-balance account per currency", () => {
    // Onboarding records opening balances later, so every row is amount 0 —
    // openBrokerage still mints the per-broker cash asset ({code}-{ccy}) and
    // registers it as the broker's settlement default for that currency.
    expect(buildBrokerageFunding(["USD", "SGD"])).toEqual([
      { currency: "USD", amount: 0 },
      { currency: "SGD", amount: 0 },
    ])
  })

  it("dedupes and trims, ignoring blanks", () => {
    expect(buildBrokerageFunding(["USD", "USD", "", " SGD "])).toEqual([
      { currency: "USD", amount: 0 },
      { currency: "SGD", amount: 0 },
    ])
  })

  it("returns no rows for an empty selection", () => {
    expect(buildBrokerageFunding([])).toEqual([])
  })
})
