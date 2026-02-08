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

describe("Weighted IRR calculation", () => {
  const mockContract: HoldingContract = JSON.parse(data).data
  const valueIn = ValueIn.PORTFOLIO
  const groupBy = GroupBy.ASSET_CLASS
  const hideEmpty = false

  it("should calculate weighted IRR for Equity group based on market value", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      groupBy,
    )
    const equities = holdings.holdingGroups["Equity"]

    // Equity group has BKNG (irr=0.35, mv=3780.03) and MCD (irr=0.08, mv=1071.8)
    // Weighted IRR = (0.35 * 3780.03 + 0.08 * 1071.8) / (3780.03 + 1071.8)
    //              = (1323.0105 + 85.744) / 4851.83
    //              = 0.2903757...
    const expectedWeightedIrr =
      (0.35 * 3780.03 + 0.08 * 1071.8) / (3780.03 + 1071.8)

    expect(equities.subTotals[ValueIn.PORTFOLIO].weightedIrr).toBeCloseTo(
      expectedWeightedIrr,
      5,
    )
    expect(equities.subTotals[ValueIn.BASE].weightedIrr).toBeCloseTo(
      expectedWeightedIrr,
      5,
    )
    expect(equities.subTotals[ValueIn.TRADE].weightedIrr).toBeCloseTo(
      expectedWeightedIrr,
      5,
    )
  })

  it("should exclude positions with zero market value from weighted IRR", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      groupBy,
    )
    // ETF group has QQQ (irr=0.25, mv=441.02) and SMH (irr=-0.35, mv=0)
    // SMH should be excluded because marketValue is 0
    // Weighted IRR = 0.25 (only QQQ contributes)
    const etfs = holdings.holdingGroups["ETF"]

    expect(etfs.subTotals[ValueIn.PORTFOLIO].weightedIrr).toBeCloseTo(0.25, 5)
  })

  it("should exclude cash positions from weighted IRR calculation", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      groupBy,
    )
    // Cash group has only USD cash position - should be excluded
    // Weighted IRR should be 0 (no qualifying positions)
    const cash = holdings.holdingGroups["Cash"]

    expect(cash.subTotals[ValueIn.PORTFOLIO].weightedIrr).toBe(0)
  })

  it("should give larger positions more weight in weighted IRR", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      groupBy,
    )
    const equities = holdings.holdingGroups["Equity"]

    // BKNG has ~78% of the group's market value (3780.03 / 4851.83)
    // MCD has ~22% of the group's market value (1071.8 / 4851.83)
    // So weighted IRR should be closer to BKNG's 35% than MCD's 8%
    const weightedIrr = equities.subTotals[ValueIn.PORTFOLIO].weightedIrr

    // Weighted IRR should be closer to 0.35 (BKNG) than to 0.08 (MCD)
    expect(weightedIrr).toBeGreaterThan(0.2) // Much closer to 0.35 than 0.08
    expect(weightedIrr).toBeLessThan(0.35) // But not higher than BKNG's IRR

    // Simple average would be (0.35 + 0.08) / 2 = 0.215
    // Weighted average should be higher because BKNG (higher IRR) has more weight
    const simpleAverage = (0.35 + 0.08) / 2
    expect(weightedIrr).toBeGreaterThan(simpleAverage)
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

  it("should group Equities by trade currency when grouping by MARKET_CURRENCY", () => {
    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      GroupBy.MARKET_CURRENCY,
    )

    // Equities should be grouped under "USD" (their trade currency)
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
