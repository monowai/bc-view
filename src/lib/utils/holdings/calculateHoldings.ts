import {
  Currency,
  HoldingContract,
  HoldingGroup,
  Holdings,
  MoneyValues,
  Position,
  Total,
} from "types/beancounter"
import { isCashRelated, isCash, isAccount } from "@lib/assets/assetUtils"
import { GroupBy, ValueIn } from "@components/features/holdings/GroupByOptions"
import { getReportCategory } from "../categoryMapping"

function getPath(path: string, position: Position): string {
  return path
    .split(".")
    .reduce(
      (p: any, path: string) => (p && p[path]) || "undefined",
      position,
    ) as unknown as string
}

/**
 * Gets the group key for a position based on the groupBy option.
 * For ASSET_CLASS grouping, uses report categories with backward compatibility.
 * For SECTOR grouping, uses sector classification with "Unclassified" as fallback.
 * For MARKET_CURRENCY grouping, Cash assets are grouped by their asset code (the currency they represent).
 * For MARKET grouping, Cash assets are grouped by their market (CASH).
 */
function getGroupKey(groupBy: GroupBy, position: Position): string {
  if (groupBy === GroupBy.ASSET_CLASS) {
    // Use report categories for asset class grouping
    return getReportCategory(position.asset)
  }
  if (groupBy === GroupBy.SECTOR) {
    // Use sector with fallback for unclassified assets
    return position.asset.sector || "Unclassified"
  }
  // For Currency grouping, Cash assets should be grouped by their asset code (the currency they represent)
  if (groupBy === GroupBy.MARKET_CURRENCY && isCash(position.asset)) {
    return position.asset.code
  }
  return getPath(groupBy, position)
}

// Helper function to update total
function updateSubTotal(
  subTotal: MoneyValues,
  position: Position,
  valueIn: ValueIn,
): MoneyValues {
  const keys: (keyof MoneyValues)[] = [
    "marketValue",
    "costValue",
    "dividends",
    "realisedGain",
    "unrealisedGain",
    "irr",
    "totalGain",
  ]
  keys.forEach((key) => {
    if (typeof position.moneyValues[valueIn][key] === "number") {
      subTotal[key] += position.moneyValues[valueIn][key]
    }
  })
  if (isCashRelated(position.asset)) {
    subTotal.cash += position.moneyValues[valueIn].marketValue
    subTotal.weight += position.moneyValues[valueIn].weight
  } else {
    subTotal.purchases += position.moneyValues[valueIn].purchases
    subTotal.sales += position.moneyValues[valueIn].sales
    subTotal.weight += position.moneyValues[valueIn].weight
    if (position.moneyValues[valueIn].priceData) {
      if (position.moneyValues[valueIn].priceData.changePercent) {
        subTotal.gainOnDay += position.moneyValues[valueIn].gainOnDay
      }
    }
  }
  return subTotal
}

function zeroTotal(currency: Currency): Total {
  return {
    marketValue: 0,
    purchases: 0,
    sales: 0,
    cash: 0,
    income: 0,
    gain: 0,
    irr: 0,
    currency: currency,
  }
}

function zeroMoneyValues(currency: Currency, valueIn: ValueIn): MoneyValues {
  return {
    costValue: 0,
    dividends: 0,
    marketValue: 0,
    realisedGain: 0,
    totalGain: 0,
    unrealisedGain: 0,
    fees: 0,
    cash: 0,
    purchases: 0,
    sales: 0,
    tax: 0,
    weight: 0,
    roi: 0,
    irr: 0,
    costBasis: 0,
    gainOnDay: 0,
    priceData: {
      close: 0,
      change: 0,
      changePercent: 0,
      priceDate: "",
      previousClose: 0,
    },
    valueIn: valueIn,
    averageCost: 0,
    currency: currency,
    weightedIrr: 0,
  }
}

function createHoldingGroup(
  _groupKey: string,
  position: Position,
): HoldingGroup {
  const initialTotals: Record<ValueIn, MoneyValues> = {
    [ValueIn.PORTFOLIO]: zeroMoneyValues(
      position.moneyValues[ValueIn.PORTFOLIO].currency,
      ValueIn.PORTFOLIO,
    ),
    [ValueIn.BASE]: zeroMoneyValues(
      position.moneyValues[ValueIn.BASE].currency,
      ValueIn.BASE,
    ),
    [ValueIn.TRADE]: zeroMoneyValues(
      position.moneyValues[ValueIn.TRADE].currency,
      ValueIn.TRADE,
    ),
  }

  return {
    positions: [],
    subTotals: initialTotals,
  }
}

function addSubtotalPosition(
  subTotals: Record<ValueIn, MoneyValues>,
  position: Position,
): Record<ValueIn, MoneyValues> {
  subTotals[ValueIn.BASE] = updateSubTotal(
    subTotals[ValueIn.BASE],
    position,
    ValueIn.BASE,
  )
  subTotals[ValueIn.PORTFOLIO] = updateSubTotal(
    subTotals[ValueIn.PORTFOLIO],
    position,
    ValueIn.PORTFOLIO,
  )
  subTotals[ValueIn.TRADE] = updateSubTotal(
    subTotals[ValueIn.TRADE],
    position,
    ValueIn.TRADE,
  )
  return subTotals
}

/**
 * Calculate weighted IRR for a group of positions.
 * Formula: Σ(position_irr × position_market_value) / Σ(position_market_value)
 * Cash positions are excluded as they don't have meaningful IRR.
 */
function calculateWeightedIrr(positions: Position[], valueIn: ValueIn): number {
  let weightedSum = 0
  let totalMarketValue = 0

  for (const position of positions) {
    // Skip cash-related positions
    if (isCashRelated(position.asset)) {
      continue
    }

    const marketValue = position.moneyValues[valueIn].marketValue
    const irr = position.moneyValues[valueIn].irr

    // Only include positions with positive market value and valid IRR
    if (marketValue > 0 && isFinite(irr)) {
      weightedSum += irr * marketValue
      totalMarketValue += marketValue
    }
  }

  // Return 0 if no valid positions to avoid division by zero
  if (totalMarketValue === 0) {
    return 0
  }

  return weightedSum / totalMarketValue
}

export function calculateHoldings(
  contract: HoldingContract,
  hideEmpty: boolean,
  valueIn: ValueIn,
  groupBy: GroupBy,
): Holdings {
  const filteredPositions = Object.keys(contract.positions).filter((key) => {
    const position = contract.positions[key]
    // Always show ACCOUNT assets (bank accounts) regardless of balance
    if (isAccount(position.asset)) {
      return true
    }
    // Apply hideEmpty filtering to other positions
    return !(hideEmpty && position.quantityValues.total === 0)
  })

  // Handle empty portfolios - use portfolio currency as fallback
  const totalsCurrency =
    contract.totals[valueIn]?.currency ?? contract.portfolio.currency

  const results = filteredPositions.reduce(
    (results: Holdings, group) => {
      const position = contract.positions[group] as Position
      const groupKey = getGroupKey(groupBy, position)
      results.holdingGroups[groupKey] =
        results.holdingGroups[groupKey] ||
        createHoldingGroup(groupKey, position)

      results.holdingGroups[groupKey].positions.push(position)
      results.holdingGroups[groupKey].subTotals = addSubtotalPosition(
        results.holdingGroups[groupKey].subTotals,
        position,
      )
      return results
    },
    {
      portfolio: contract.portfolio,
      holdingGroups: {}, // Initialize as an empty object
      valueIn: valueIn,
      currency: { code: "", symbol: "" } as Currency,
      totals: zeroTotal(totalsCurrency),
      viewTotals: zeroMoneyValues(contract.portfolio.currency, valueIn),
    },
  )

  // Post process results now that all positions have been processed
  results.valueIn = valueIn
  results.currency = totalsCurrency
  results.totals = contract.totals[valueIn] ?? zeroTotal(totalsCurrency)

  // Calculate weighted IRR for each holding group
  Object.values(results.holdingGroups).forEach((group: HoldingGroup) => {
    const weightedIrr = calculateWeightedIrr(group.positions, valueIn)
    group.subTotals[ValueIn.PORTFOLIO].weightedIrr = weightedIrr
    group.subTotals[ValueIn.BASE].weightedIrr = weightedIrr
    group.subTotals[ValueIn.TRADE].weightedIrr = weightedIrr
  })

  results.viewTotals = calculateSummaryTotals(results, valueIn)
  return results
}

// Call calculateViewTotal after all holdingGroups have been computed
function calculateSummaryTotals(
  holdings: Holdings,
  valueIn: ValueIn,
): MoneyValues {
  // Initialize viewTotals with zero values.
  const viewTotals = zeroMoneyValues(holdings.currency!, valueIn)
  Object.values(holdings.holdingGroups).forEach((group: HoldingGroup) => {
    // Update viewTotals for each group
    viewTotals.marketValue += group.subTotals[valueIn].marketValue
    viewTotals.weight += group.subTotals[valueIn].weight
    viewTotals.purchases += group.subTotals[valueIn].purchases
    viewTotals.sales += group.subTotals[valueIn].sales
    viewTotals.cash += group.subTotals[valueIn].cash
    viewTotals.dividends += group.subTotals[valueIn].dividends
    viewTotals.gainOnDay += group.subTotals[valueIn].gainOnDay
    viewTotals.realisedGain += group.subTotals[valueIn].realisedGain
    viewTotals.unrealisedGain += group.subTotals[valueIn].unrealisedGain
    viewTotals.totalGain += group.subTotals[valueIn].totalGain
    viewTotals.costValue += group.subTotals[valueIn].costValue
  })

  // Return the updated viewTotals after the loop
  return viewTotals
}
