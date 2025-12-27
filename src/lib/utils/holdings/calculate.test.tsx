import { HoldingContract, HoldingGroup, Holdings } from "types/beancounter"
import * as path from "node:path"
import * as fs from "node:fs"
import { GroupBy, ValueIn } from "@components/features/holdings/GroupByOptions"
import { calculateHoldings } from "@lib/holdings/calculateHoldings"
import { describe, expect, it } from "@jest/globals"

const dataPath = path.resolve(__dirname, "./__fixtures__/test-holdings.json")
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

  it("including all exited positions should compute sub totals", () => {
    const hideEmpty = false

    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      groupBy,
    )
    expect(holdings.portfolio).toEqual(mockContract.portfolio)
    expect(holdings.holdingGroups["Cash"].positions.length).toEqual(1)
    const equities = holdings.holdingGroups["Equity"]
    expect(equities.positions.length).toEqual(2)
    expect(equities.subTotals[ValueIn.PORTFOLIO].costValue).toEqual(3701.0)
    expect(equities.subTotals[ValueIn.TRADE].costValue).toEqual(3701.0)
    expect(equities.subTotals[ValueIn.BASE].costValue).toEqual(3701.0)
    // ETF category is now mapped from "Exchange Traded Fund" to "ETF" via report categories
    const etfs = holdings.holdingGroups["ETF"]
    expect(etfs.positions.length).toEqual(2)
    validateEtfGains(etfs)
    validateTotals(holdings)
  })

  it("should compute totals when showing exited positions", () => {
    const hideEmpty = true

    const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy)
    expect(result.holdingGroups["Cash"].positions.length).toEqual(1)
    const equities = result.holdingGroups["Equity"]
    expect(equities.positions.length).toEqual(2)
    // ETF category is now mapped from "Exchange Traded Fund" to "ETF" via report categories
    const etfs = result.holdingGroups["ETF"]
    expect(etfs.positions.length).toEqual(1)
    validateEtfGains(etfs)
    validateTotals(result)
  })

  it("calculate all sub-totals when hiding exited positions", () => {
    const hideEmpty = false

    const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy)
    expect(result.viewTotals.marketValue).toEqual(11033.85)
    expect(result.viewTotals.gainOnDay).toEqual(118.83)

    expect(result.viewTotals.realisedGain).toEqual(-224.67)
  })
  it("calculate all sub-totals when showing exited positions", () => {
    const hideEmpty = true

    const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy)
    expect(result.viewTotals.marketValue).toEqual(11033.85)
    expect(result.viewTotals.gainOnDay).toEqual(118.83)
    expect(result.viewTotals.realisedGain).toEqual(134.33)
  })
})

describe("Cash grouping behavior", () => {
  const mockContract: HoldingContract = JSON.parse(data).data
  const valueIn = ValueIn.PORTFOLIO
  const hideEmpty = false

  it("should group Cash by currency code when grouping by MARKET_CURRENCY", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      GroupBy.MARKET_CURRENCY,
    )

    // Cash (USD) should be grouped under "USD" (the asset code), not the market's currency
    expect(holdings.holdingGroups["USD"]).toBeDefined()
    expect(
      holdings.holdingGroups["USD"].positions.length,
    ).toBeGreaterThanOrEqual(1)

    // Verify the Cash position is in the USD group
    const cashPosition = holdings.holdingGroups["USD"].positions.find(
      (p) => p.asset.assetCategory.id === "CASH",
    )
    expect(cashPosition).toBeDefined()
    expect(cashPosition?.asset.code).toEqual("USD")
  })

  it("should group Cash by market when grouping by MARKET", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      GroupBy.MARKET,
    )

    // Cash should be grouped under "CASH" market
    expect(holdings.holdingGroups["CASH"]).toBeDefined()
    expect(holdings.holdingGroups["CASH"].positions.length).toEqual(1)

    // Verify the Cash position is in the CASH market group
    const cashPosition = holdings.holdingGroups["CASH"].positions[0]
    expect(cashPosition.asset.assetCategory.id).toEqual("CASH")
    expect(cashPosition.asset.market.code).toEqual("CASH")
  })

  it("should group Equities by market currency when grouping by MARKET_CURRENCY", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      GroupBy.MARKET_CURRENCY,
    )

    // Equities on US market should be grouped under "USD" (the market's currency)
    expect(holdings.holdingGroups["USD"]).toBeDefined()

    // Find equity positions in USD group
    const equityPositions = holdings.holdingGroups["USD"].positions.filter(
      (p) => p.asset.assetCategory.id === "EQUITY",
    )
    expect(equityPositions.length).toEqual(2) // BKNG and MCD
  })

  it("should group Equities by market when grouping by MARKET", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      GroupBy.MARKET,
    )

    // Equities on US market should be grouped under "US"
    expect(holdings.holdingGroups["US"]).toBeDefined()

    // Find equity positions in US group
    const equityPositions = holdings.holdingGroups["US"].positions.filter(
      (p) => p.asset.assetCategory.id === "EQUITY",
    )
    expect(equityPositions.length).toEqual(2) // BKNG and MCD
  })
})
