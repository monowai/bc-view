import { useMemo } from "react"
import { Portfolio, HoldingContract } from "types/beancounter"
import { mapToLiquidityGroup, WealthSummary } from "@lib/wealth/liquidityGroups"

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

export function useWealthSummary(
  portfolios: Portfolio[],
  fxRates: Record<string, number>,
  sortConfig: SortConfig,
  holdingsData: HoldingContract | undefined,
): WealthSummary {
  return useMemo(() => {
    if (portfolios.length === 0 || Object.keys(fxRates).length === 0) {
      return {
        totalValue: 0,
        totalGainOnDay: 0,
        portfolioCount: 0,
        classificationBreakdown: [],
        portfolioBreakdown: [],
      }
    }

    let totalValue = 0
    const portfolioValues: {
      code: string
      name: string
      value: number
      irr: number
    }[] = []

    portfolios.forEach((portfolio) => {
      // marketValue is stored in the portfolio's BASE currency
      const marketValue = portfolio.marketValue || 0
      const rate = fxRates[portfolio.base.code] || 1
      const convertedValue = marketValue * rate

      totalValue += convertedValue

      portfolioValues.push({
        code: portfolio.code,
        name: portfolio.name,
        value: convertedValue,
        irr: portfolio.irr || 0,
      })
    })

    // Calculate liquidity breakdown and total gain on day from holdings
    const classificationTotals: Record<string, number> = {}
    let totalGainOnDay = 0
    if (holdingsData?.positions) {
      Object.values(holdingsData.positions).forEach((position) => {
        const classification = mapToLiquidityGroup(
          position.asset?.assetCategory?.name || "Uncategorised",
        )
        const positionValue = position.moneyValues?.BASE?.marketValue || 0
        classificationTotals[classification] =
          (classificationTotals[classification] || 0) + positionValue

        // Sum gainOnDay only when there's price data (gainOnDay is meaningless without it)
        // Apply FX conversion from position's BASE currency to display currency
        const priceData = position.moneyValues?.BASE?.priceData
        if (priceData?.changePercent) {
          const gainOnDay = position.moneyValues?.BASE?.gainOnDay || 0
          const positionCurrency = position.moneyValues?.BASE?.currency?.code
          const rate = positionCurrency ? fxRates[positionCurrency] || 1 : 1
          totalGainOnDay += gainOnDay * rate
        }
      })
    }

    const classificationTotal = Object.values(classificationTotals).reduce(
      (sum, val) => sum + val,
      0,
    )
    const classificationBreakdown = Object.entries(classificationTotals)
      .map(([classification, value]) => ({
        classification,
        value,
        percentage:
          classificationTotal > 0 ? (value / classificationTotal) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)

    const portfolioBreakdown = portfolioValues
      .map((p) => ({
        ...p,
        percentage: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => {
        if (!sortConfig.key) return 0
        let aVal: string | number
        let bVal: string | number
        switch (sortConfig.key) {
          case "code":
            aVal = a.code.toLowerCase()
            bVal = b.code.toLowerCase()
            break
          case "value":
            aVal = a.value
            bVal = b.value
            break
          case "percentage":
            aVal = a.percentage
            bVal = b.percentage
            break
          case "irr":
            aVal = a.irr
            bVal = b.irr
            break
          default:
            return 0
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          const result = aVal.localeCompare(bVal)
          return sortConfig.direction === "asc" ? result : -result
        }
        const result = (aVal as number) - (bVal as number)
        return sortConfig.direction === "asc" ? result : -result
      })

    return {
      totalValue,
      totalGainOnDay,
      portfolioCount: portfolios.length,
      classificationBreakdown,
      portfolioBreakdown,
    }
  }, [portfolios, fxRates, sortConfig, holdingsData])
}
