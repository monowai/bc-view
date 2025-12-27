import { HoldingContract, HoldingGroup, Position } from "types/beancounter"
import * as path from "node:path"
import * as fs from "node:fs"
import { GroupBy, ValueIn } from "@components/features/holdings/GroupByOptions"
import { calculateHoldings } from "@lib/holdings/calculateHoldings"
import { sortPositions, SortConfig } from "@lib/holdings/sortHoldings"
import { describe, expect, it } from "@jest/globals"

const dataPath = path.resolve(__dirname, "./__fixtures__/sort-holdings.json")
const data = fs.readFileSync(dataPath, "utf-8")

describe("calculate function", () => {
  const mockContract: HoldingContract = JSON.parse(data).data
  const valueIn = ValueIn.PORTFOLIO
  const groupBy = GroupBy.ASSET_CLASS

  it("should group by report category (Equity, ETF, Cash)", () => {
    const result = calculateHoldings(mockContract, true, valueIn, groupBy)
    expect(result.holdingGroups["Cash"].positions.length).toEqual(1)
    const equities = result.holdingGroups["Equity"]
    expect(equities.positions.length).toEqual(2)
    // ETF category now maps "Exchange Traded Fund" to "ETF" via report categories
    const etfs = result.holdingGroups["ETF"]
    expect(etfs.positions.length).toEqual(2)
  })
})

describe("sortPositions", () => {
  // Helper to create a minimal position for testing
  const createPosition = (
    code: string,
    category: string,
    marketValue: number,
  ): Position =>
    ({
      asset: {
        id: code,
        code,
        name: code,
        assetCategory: { id: category, name: category },
        market: { code: "TEST", currency: { code: "USD" } },
      },
      moneyValues: {
        PORTFOLIO: {
          marketValue,
          costValue: 0,
          priceData: { close: 100, changePercent: 0 },
        },
      },
      quantityValues: { total: 1 },
    }) as unknown as Position

  it("should sort cash positions last when sorting by asset name", () => {
    const holdingGroup: HoldingGroup = {
      positions: [
        createPosition("USD", "CASH", 1000), // Cash first
        createPosition("AAPL", "EQUITY", 5000),
        createPosition("GOOGL", "EQUITY", 3000),
      ],
      subTotals: {} as any,
    }

    const sortConfig: SortConfig = { key: "assetName", direction: "asc" }
    const result = sortPositions(holdingGroup, sortConfig, "PORTFOLIO")

    // Cash should be last, regardless of alphabetical order
    expect(result.positions[0].asset.code).toBe("AAPL")
    expect(result.positions[1].asset.code).toBe("GOOGL")
    expect(result.positions[2].asset.code).toBe("USD") // Cash last
  })

  it("should sort cash positions last when sorting by market value descending", () => {
    const holdingGroup: HoldingGroup = {
      positions: [
        createPosition("USD", "CASH", 10000), // Cash with highest value
        createPosition("AAPL", "EQUITY", 5000),
        createPosition("GOOGL", "EQUITY", 3000),
      ],
      subTotals: {} as any,
    }

    const sortConfig: SortConfig = { key: "marketValue", direction: "desc" }
    const result = sortPositions(holdingGroup, sortConfig, "PORTFOLIO")

    // Cash should be last even though it has highest value
    expect(result.positions[0].asset.code).toBe("AAPL")
    expect(result.positions[1].asset.code).toBe("GOOGL")
    expect(result.positions[2].asset.code).toBe("USD") // Cash last
  })

  it("should sort multiple cash positions together at the end", () => {
    const holdingGroup: HoldingGroup = {
      positions: [
        createPosition("USD", "CASH", 1000),
        createPosition("AAPL", "EQUITY", 5000),
        createPosition("NZD", "CASH", 2000),
        createPosition("GOOGL", "EQUITY", 3000),
      ],
      subTotals: {} as any,
    }

    const sortConfig: SortConfig = { key: "assetName", direction: "asc" }
    const result = sortPositions(holdingGroup, sortConfig, "PORTFOLIO")

    // Non-cash sorted alphabetically, then cash sorted alphabetically
    expect(result.positions[0].asset.code).toBe("AAPL")
    expect(result.positions[1].asset.code).toBe("GOOGL")
    expect(result.positions[2].asset.code).toBe("NZD") // Cash, sorted alphabetically
    expect(result.positions[3].asset.code).toBe("USD") // Cash, sorted alphabetically
  })
})
