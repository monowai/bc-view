import { deriveBrokerCode } from "./brokerCode"

describe("deriveBrokerCode", () => {
  it("collapses a multi-word broker name to its word initials", () => {
    expect(deriveBrokerCode("Interactive Brokers")).toBe("IB")
    expect(deriveBrokerCode("Charles Schwab")).toBe("CS")
    expect(deriveBrokerCode("Morgan Stanley")).toBe("MS")
  })

  it("keeps a single-word name as its full alphanumeric uppercase form", () => {
    expect(deriveBrokerCode("Fidelity")).toBe("FIDELITY")
    expect(deriveBrokerCode("DBS")).toBe("DBS")
  })

  it("prefers the curated house abbreviation where initials would be wrong", () => {
    expect(deriveBrokerCode("JP Morgan")).toBe("JPM")
    expect(deriveBrokerCode("TD Ameritrade")).toBe("TDA")
  })

  it("is case-insensitive for the curated map", () => {
    expect(deriveBrokerCode("jp morgan")).toBe("JPM")
  })

  it("strips punctuation from initials", () => {
    expect(deriveBrokerCode("Smith & Co")).toBe("SC")
  })

  it("trims and tolerates extra whitespace", () => {
    expect(deriveBrokerCode("  Interactive   Brokers  ")).toBe("IB")
  })

  it("returns empty string for a blank name", () => {
    expect(deriveBrokerCode("")).toBe("")
    expect(deriveBrokerCode("   ")).toBe("")
  })
})
