import { describeMove, parsePercentMove, priceFromMove } from "./percentMove"

describe("parsePercentMove", () => {
  it("reads an unsigned percentage as a move below", () => {
    expect(parsePercentMove("7%")).toEqual({ pct: 7, above: false })
  })

  it("reads a minus sign, ASCII or Unicode, as a move below", () => {
    expect(parsePercentMove("-7%")).toEqual({ pct: 7, above: false })
    expect(parsePercentMove("−7%")).toEqual({ pct: 7, above: false })
  })

  it("reads a plus sign as a move above", () => {
    expect(parsePercentMove("+3%")).toEqual({ pct: 3, above: true })
  })

  it("accepts decimals and surrounding spaces", () => {
    expect(parsePercentMove("  - 12.5 % ")).toEqual({
      pct: 12.5,
      above: false,
    })
  })

  it.each(["", "7", "abc%", "%", "7%%", "1.2.3%", "--7%"])(
    "returns null for %p",
    (text) => {
      expect(parsePercentMove(text)).toBeNull()
    },
  )
})

describe("priceFromMove", () => {
  it("moves the close down by the percentage", () => {
    expect(priceFromMove(597.6, { pct: 7, above: false }, 2)).toBe("555.77")
  })

  it("moves the close up by the percentage", () => {
    expect(priceFromMove(597.6, { pct: 3, above: true }, 2)).toBe("615.53")
  })

  it("rounds to the given price places", () => {
    expect(priceFromMove(0.7035, { pct: 5, above: false }, 4)).toBe("0.6683")
  })

  it("leaves the close as it is for a zero move", () => {
    expect(priceFromMove(597.6, { pct: 0, above: false }, 2)).toBe("597.60")
  })
})

describe("describeMove", () => {
  it("names the direction of the move", () => {
    expect(describeMove({ pct: 7, above: false })).toBe("7% below close")
    expect(describeMove({ pct: 12.5, above: true })).toBe("12.5% above close")
  })
})
