import { parseSearchInput } from "../parseSearchInput"

const knownMarkets = ["US", "NZX", "ASX", "FIGI", "LOCAL"]

describe("parseSearchInput", () => {
  it("returns keyword as-is when no colon present", () => {
    const result = parseSearchInput("AAPL", knownMarkets, "LOCAL")
    expect(result).toEqual({
      market: "LOCAL",
      keyword: "AAPL",
      validMarket: true,
    })
  })

  it("uses provided defaultMarket", () => {
    const result = parseSearchInput("VOO", knownMarkets, "US")
    expect(result).toEqual({
      market: "US",
      keyword: "VOO",
      validMarket: true,
    })
  })

  it("parses MARKET:KEYWORD with a known market", () => {
    const result = parseSearchInput("NZX:VCT", knownMarkets)
    expect(result).toEqual({
      market: "NZX",
      keyword: "VCT",
      validMarket: true,
    })
  })

  it("uppercases the market prefix", () => {
    const result = parseSearchInput("nzx:VCT", knownMarkets)
    expect(result).toEqual({
      market: "NZX",
      keyword: "VCT",
      validMarket: true,
    })
  })

  it("trims whitespace from keyword after colon", () => {
    const result = parseSearchInput("ASX: BHP", knownMarkets)
    expect(result).toEqual({
      market: "ASX",
      keyword: "BHP",
      validMarket: true,
    })
  })

  it("marks unknown market prefix as invalid", () => {
    const result = parseSearchInput("FAKE:AAPL", knownMarkets)
    expect(result).toEqual({
      market: "FAKE",
      keyword: "AAPL",
      validMarket: false,
    })
  })

  it("treats colon at position 0 as plain keyword", () => {
    const result = parseSearchInput(":something", knownMarkets, "LOCAL")
    expect(result).toEqual({
      market: "LOCAL",
      keyword: ":something",
      validMarket: true,
    })
  })

  it("defaults market to LOCAL when no defaultMarket given and no colon", () => {
    const result = parseSearchInput("AAPL", knownMarkets)
    expect(result).toEqual({
      market: "LOCAL",
      keyword: "AAPL",
      validMarket: true,
    })
  })

  it("handles empty knownMarkets gracefully", () => {
    const result = parseSearchInput("NZX:VCT", [])
    expect(result).toEqual({
      market: "NZX",
      keyword: "VCT",
      validMarket: false,
    })
  })

  it("handles undefined knownMarkets gracefully", () => {
    const result = parseSearchInput("NZX:VCT")
    expect(result).toEqual({
      market: "NZX",
      keyword: "VCT",
      validMarket: false,
    })
  })
})
