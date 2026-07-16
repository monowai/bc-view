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
  // Sub-account balances for composite assets that DO NOT have a parent
  // trn in any portfolio (e.g. a CPF the user added as a config-only
  // pension). Excludes MA (healthcare reserve). Added to totalValue.
  customAssetTotals: Record<string, number> = {},
  // CPF MA / Healthcare Reserve balances per currency. Reported on
  // WealthSummary.healthcareReserve as an informational subset of
  // totalValue — NOT subtracted, so Net Worth still reconciles with the
  // sum of portfolio market values. The parent composite asset already
  // counts MA via its BALANCE trn; this number lets the UI annotate
  // "of which is statutory healthcare reserve" without breaking the
  // top-line reconciliation.
  healthcareReserveTotals: Record<string, number> = {},
): WealthSummary {
  return useMemo(() => {
    const hasCustomAssets = Object.keys(customAssetTotals).length > 0
    const hasReserve = Object.keys(healthcareReserveTotals).length > 0
    if (
      (portfolios.length === 0 && !hasCustomAssets && !hasReserve) ||
      Object.keys(fxRates).length === 0
    ) {
      return {
        totalValue: 0,
        totalGainOnDay: 0,
        portfolioCount: 0,
        healthcareReserve: 0,
        classificationBreakdown: [],
        portfolioBreakdown: [],
      }
    }

    const portfolioValues: {
      code: string
      name: string
      value: number
      irr: number
    }[] = []

    // Per-portfolio persisted marketValue — drives the breakdown table rows.
    let portfolioMarketValueTotal = 0
    portfolios.forEach((portfolio) => {
      // marketValue is stored in the portfolio's BASE currency
      const marketValue = portfolio.marketValue || 0
      const rate = fxRates[portfolio.base.code] || 1
      const convertedValue = marketValue * rate

      portfolioMarketValueTotal += convertedValue

      portfolioValues.push({
        code: portfolio.code,
        name: portfolio.name,
        value: convertedValue,
        irr: portfolio.irr || 0,
      })
    })

    // Headline: prefer the live aggregated holdings total (Σ live positions in
    // BASE) over the persisted per-portfolio marketValue, which lags current FX
    // until svc-position revalues. Reading totals.BASE keeps the headline
    // reconciled with the holdings drill-down. Fall back to the persisted sum
    // when holdings (or their totals) are unavailable.
    const liveBase = holdingsData?.totals?.BASE
    let totalValue =
      liveBase && typeof liveBase.marketValue === "number"
        ? liveBase.marketValue * (fxRates[liveBase.currency?.code] || 1)
        : portfolioMarketValueTotal

    Object.entries(customAssetTotals).forEach(([currency, balance]) => {
      const rate = fxRates[currency] || 1
      totalValue += balance * rate
    })

    let healthcareReserve = 0
    Object.entries(healthcareReserveTotals).forEach(([currency, balance]) => {
      const rate = fxRates[currency] || 1
      healthcareReserve += balance * rate
    })

    // Calculate liquidity breakdown and total gain on day from holdings
    const classificationTotals: Record<string, number> = {}
    let totalGainOnDay = 0
    if (holdingsData?.positions) {
      Object.values(holdingsData.positions).forEach((position) => {
        const classification = mapToLiquidityGroup(
          position.asset?.assetCategory?.name || "Uncategorised",
        )
        // Apply FX conversion from position's BASE currency to display currency
        const positionCurrency = position.moneyValues?.BASE?.currency?.code
        const rate = positionCurrency ? fxRates[positionCurrency] || 1 : 1
        const positionValue =
          (position.moneyValues?.BASE?.marketValue || 0) * rate
        classificationTotals[classification] =
          (classificationTotals[classification] || 0) + positionValue

        // Sum gainOnDay only when there's price data (gainOnDay is meaningless without it)
        const priceData = position.moneyValues?.BASE?.priceData
        if (priceData?.changePercent) {
          const gainOnDay = position.moneyValues?.BASE?.gainOnDay || 0
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
      healthcareReserve,
      classificationBreakdown,
      portfolioBreakdown,
    }
  }, [
    portfolios,
    fxRates,
    sortConfig,
    holdingsData,
    customAssetTotals,
    healthcareReserveTotals,
  ])
}
