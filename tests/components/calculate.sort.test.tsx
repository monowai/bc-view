import {
  HoldingContract,
  HoldingGroup,
  Holdings,
} from "@components/types/beancounter"
import * as path from "node:path"
import * as fs from "node:fs"
import { GroupBy, ValueIn } from "@components/holdings/GroupByOptions"
import { calculateHoldings } from "@utils/holdings/calculateHoldings"
import { it, expect, describe } from "@jest/globals"

const dataPath = path.resolve(__dirname, "../__contracts__/sort-holdings.json")
const data = fs.readFileSync(dataPath, "utf-8")

function validateTotals(result: Holdings): void {
  const totalGain = 1033.85
  expect(result.totals.gain).toEqual(totalGain)
}

function validateEtfGains(etfs: HoldingGroup): void {
  const expectedGain = 107.69
  expect(etfs.subTotals[ValueIn.PORTFOLIO].unrealisedGain).toEqual(expectedGain)
  expect(etfs.subTotals[ValueIn.BASE].unrealisedGain).toEqual(expectedGain)
  expect(etfs.subTotals[ValueIn.TRADE].unrealisedGain).toEqual(expectedGain)
}

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
