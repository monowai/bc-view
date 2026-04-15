import { extractTickers } from "../tickerExtraction"
import { Position } from "types/beancounter"

function makePosition(
  code: string,
  categoryName: string,
  marketCode = "US",
): Record<string, Position> {
  return {
    [code]: {
      asset: {
        id: code,
        code,
        name: code,
        assetCategory: { id: categoryName, name: categoryName },
        market: {
          code: marketCode,
          name: marketCode,
          currency: { code: "USD", symbol: "$", name: "US Dollar" },
        },
      },
      moneyValues: {},
      quantityValues: {},
      dateValues: {},
      lastTradeDate: "",
      roi: 0,
    } as unknown as Position,
  }
}

describe("extractTickers", () => {
  it("returns empty array for empty positions", () => {
    expect(extractTickers({})).toEqual([])
  })

  it("extracts EQUITY ticker codes", () => {
    const positions = makePosition("AAPL", "EQUITY")
    expect(extractTickers(positions)).toEqual(["AAPL"])
  })

  it("extracts ETF ticker codes", () => {
    const positions = makePosition("VOO", "ETF")
    expect(extractTickers(positions)).toEqual(["VOO"])
  })

  it("filters out CASH positions", () => {
    const positions = makePosition("USD", "CASH")
    expect(extractTickers(positions)).toEqual([])
  })

  it("filters out ACCOUNT positions", () => {
    const positions = makePosition("CPF-OA", "ACCOUNT")
    expect(extractTickers(positions)).toEqual([])
  })

  it("filters out POLICY positions", () => {
    const positions = makePosition("ILP-001", "POLICY")
    expect(extractTickers(positions)).toEqual([])
  })

  it("filters out PRIVATE market positions", () => {
    const positions = makePosition("MY-HOUSE", "RE", "PRIVATE")
    expect(extractTickers(positions)).toEqual([])
  })

  it("handles mixed position types", () => {
    const positions = {
      ...makePosition("AAPL", "EQUITY"),
      ...makePosition("VOO", "ETF"),
      ...makePosition("USD", "CASH"),
      ...makePosition("CPF-OA", "ACCOUNT"),
      ...makePosition("MSFT", "EQUITY"),
    }
    const result = extractTickers(positions)
    expect(result).toEqual(expect.arrayContaining(["AAPL", "VOO", "MSFT"]))
    expect(result).toHaveLength(3)
    expect(result).not.toContain("USD")
    expect(result).not.toContain("CPF-OA")
  })
})
