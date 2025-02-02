import { HoldingContract } from "types/beancounter"
import * as path from "node:path"
import * as fs from "node:fs"
import { GroupBy, ValueIn } from "@components/holdings/GroupByOptions"
import { calculateHoldings } from "@utils/holdings/calculateHoldings"
import { describe, expect, it } from "@jest/globals"

const dataPath = path.resolve(__dirname, "../__contracts__/sort-holdings.json")
const data = fs.readFileSync(dataPath, "utf-8")

describe("calculate function", () => {
  const mockContract: HoldingContract = JSON.parse(data).data
  const valueIn = ValueIn.PORTFOLIO
  const groupBy = GroupBy.ASSET_CLASS

  it("should sort by Equity, ETF then Cash", () => {
    const result = calculateHoldings(mockContract, true, valueIn, groupBy)
    expect(result.holdingGroups["Cash"].positions.length).toEqual(1)
    const equities = result.holdingGroups["Equity"]
    expect(equities.positions.length).toEqual(2)
    const etfs = result.holdingGroups["Exchange Traded Fund"]
    expect(etfs.positions.length).toEqual(2)
    result.holdingGroups
  })
})
