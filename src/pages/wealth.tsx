import React, { useEffect, useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import useSwr from "swr"
import {
  portfoliosKey,
  simpleFetcher,
  ccyKey,
  holdingKey,
} from "@utils/api/fetchHelper"
import {
  Portfolio,
  Currency,
  FxResponse,
  HoldingContract,
  Transaction,
} from "types/beancounter"
import { PlansResponse as IndependencePlansResponse } from "types/independence"
import {
  useAssetBreakdown,
  useFiProjectionSimple,
} from "@components/features/independence"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import { FormatValue } from "@components/ui/MoneyUtils"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"

// Color palette for charts
const COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
]

interface WealthSummary {
  totalValue: number
  totalGainOnDay: number
  portfolioCount: number
  classificationBreakdown: {
    classification: string
    value: number
    percentage: number
  }[]
  portfolioBreakdown: {
    code: string
    name: string
    value: number
    percentage: number
    irr: number
  }[]
}

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

function WealthDashboard(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const { preferences } = useUserPreferences()
  const { hideValues } = usePrivacyMode()
  const router = useRouter()
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "value",
    direction: "desc",
  })

  // Collapsible sections state - all collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({
    independence: true,
    charts: true,
    portfolioDetails: true,
  })
  const toggleSection = (section: string): void => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  // Fetch portfolios
  const {
    data: portfolioData,
    error: portfolioError,
    isLoading: portfolioLoading,
  } = useSwr(portfoliosKey, simpleFetcher(portfoliosKey))

  // Fetch aggregated holdings for asset classification breakdown
  // Use SWR caching to persist across refreshes
  const holdingKeyUrl = holdingKey("aggregated", "today")
  const { data: holdingsResponse, isLoading: holdingsLoading } = useSwr<{
    data: HoldingContract
  }>(holdingKeyUrl, simpleFetcher(holdingKeyUrl), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // Cache for 60 seconds
  })
  const holdingsData = holdingsResponse?.data

  // Fetch currencies
  const { data: currencyData } = useSwr<{ data: Currency[] }>(
    ccyKey,
    simpleFetcher(ccyKey),
  )

  // Fetch independence plans
  const { data: plansData } = useSwr<IndependencePlansResponse>(
    "/api/independence/plans",
    simpleFetcher("/api/independence/plans"),
  )

  // Get the first plan (or could allow selection)
  const primaryPlan = plansData?.data?.[0]

  const currencies = useMemo(
    () => currencyData?.data || [],
    [currencyData?.data],
  )
  const portfolios: Portfolio[] = useMemo(
    () => portfolioData?.data || [],
    [portfolioData?.data],
  )

  // Display currency state
  const [displayCurrency, setDisplayCurrency] = useState<Currency | null>(null)
  const [fxRates, setFxRates] = useState<Record<string, number>>({})

  // Fetch monthly investment for current month (depends on display currency)
  const monthlyInvestmentUrl = displayCurrency
    ? `/api/trns/investments/monthly?currency=${displayCurrency.code}`
    : null
  const { data: monthlyInvestmentData } = useSwr<{
    yearMonth: string
    totalInvested: number
    currency?: string
  }>(
    monthlyInvestmentUrl,
    monthlyInvestmentUrl ? simpleFetcher(monthlyInvestmentUrl) : null,
  )

  // Modal state for showing investment transactions
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)

  // Fetch transactions only when modal is open
  const investmentTrnsUrl = showInvestmentModal
    ? "/api/trns/investments/monthly/transactions"
    : null
  const { data: investmentTrnsData } = useSwr<{ data: Transaction[] }>(
    investmentTrnsUrl,
    investmentTrnsUrl ? simpleFetcher(investmentTrnsUrl) : null,
  )

  // Set default display currency
  useEffect(() => {
    if (currencies.length === 0 || displayCurrency) return

    if (preferences?.baseCurrencyCode) {
      const preferred = currencies.find(
        (c) => c.code === preferences.baseCurrencyCode,
      )
      if (preferred) {
        setDisplayCurrency(preferred)
        return
      }
    }

    // Default to USD or first currency
    const usd = currencies.find((c) => c.code === "USD")
    setDisplayCurrency(usd || currencies[0])
  }, [currencies, displayCurrency, preferences?.baseCurrencyCode])

  // Fetch FX rates for portfolio base currencies
  // Note: portfolio.marketValue is stored in the portfolio's BASE currency
  useEffect(() => {
    if (!displayCurrency || portfolios.length === 0) return

    const uniqueCurrencies = [...new Set(portfolios.map((p) => p.base.code))]
    const pairs = uniqueCurrencies
      .filter((code) => code !== displayCurrency.code)
      .map((code) => ({ from: code, to: displayCurrency.code }))

    if (pairs.length === 0) {
      // All portfolios are in display currency
      const rates: Record<string, number> = {}
      uniqueCurrencies.forEach((code) => {
        rates[code] = 1
      })
      setFxRates(rates)
      return
    }

    fetch("/api/fx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateDate: "today", pairs }),
    })
      .then((res) => res.json())
      .then((fxResponse: FxResponse) => {
        const rates: Record<string, number> = {}
        rates[displayCurrency.code] = 1

        Object.entries(fxResponse.data?.rates || {}).forEach(
          ([key, rateData]) => {
            const [from] = key.split(":")
            rates[from] = rateData.rate
          },
        )
        setFxRates(rates)
      })
      .catch(console.error)
  }, [displayCurrency, portfolios])

  const fxReady = Object.keys(fxRates).length > 0

  // Handle sorting
  const handleSort = (key: string): void => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: key === "code" ? "asc" : "desc" }
    })
  }

  // Sort icon component
  const getSortIcon = (headerKey: string): React.ReactElement => {
    if (sortConfig.key !== headerKey) {
      return <span className="ml-1 text-gray-400">↕</span>
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-blue-500">↑</span>
    ) : (
      <span className="ml-1 text-blue-500">↓</span>
    )
  }

  // Calculate wealth summary
  const summary: WealthSummary = useMemo(() => {
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

    // Calculate asset classification breakdown and total gain on day from holdings
    const classificationTotals: Record<string, number> = {}
    let totalGainOnDay = 0
    if (holdingsData?.positions) {
      Object.values(holdingsData.positions).forEach((position) => {
        let classification =
          position.asset?.assetCategory?.name || "Uncategorised"
        // Merge "Bank Account" into "Cash" as they represent the same thing
        if (classification === "Bank Account") {
          classification = "Cash"
        }
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

  // Calculate asset breakdown from holdings
  // Only calculate when holdings have finished loading
  const assets = useAssetBreakdown(holdingsLoading ? undefined : holdingsData)

  // Fetch FI projection using shared hook
  // Uses PORTFOLIO currency values (default) for asset breakdown
  const { projection: projectionData, isLoading: projectionLoading } =
    useFiProjectionSimple({
      plan: primaryPlan,
      assets,
    })

  // Chart data
  const portfolioChartData = summary.portfolioBreakdown.map((p) => ({
    name: p.code,
    value: p.value,
  }))

  const classificationChartData = summary.classificationBreakdown.map((c) => ({
    name: c.classification,
    value: c.value,
  }))

  if (portfolioError) {
    return errorOut(t("portfolios.error.retrieve"), portfolioError)
  }

  if (portfolioLoading || !ready || !fxReady) {
    return rootLoader(t("loading"))
  }

  return (
    <>
      <Head>
        <title>Net Worth | Holdsworth</title>
      </Head>

      <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Net Worth</h1>
              <p className="text-gray-600 mt-1">
                Your total wealth across all portfolios
              </p>
            </div>

            {/* Currency Selector */}
            {currencies.length > 0 && displayCurrency && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Display in:</span>
                <select
                  value={displayCurrency.code}
                  onChange={(e) => {
                    const selected = currencies.find(
                      (c) => c.code === e.target.value,
                    )
                    if (selected) setDisplayCurrency(selected)
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Total Net Worth Card */}
          <div className="bg-linear-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 mb-8 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <p className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">
                  Total Net Worth
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-5xl font-bold">
                    {displayCurrency?.symbol}
                    <FormatValue value={summary.totalValue} />
                  </span>
                </div>
                {summary.totalGainOnDay !== 0 && !hideValues && (
                  <div
                    className={`text-xl md:text-2xl font-semibold mt-1 ${summary.totalGainOnDay >= 0 ? "text-green-300" : "text-red-300"}`}
                  >
                    {summary.totalGainOnDay >= 0 ? "+" : ""}
                    {displayCurrency?.symbol}
                    <FormatValue value={summary.totalGainOnDay} />
                    <span className="text-base ml-2 opacity-75">
                      gain on day
                    </span>
                  </div>
                )}
                <p className="text-blue-200 mt-2">
                  Across {summary.portfolioCount} portfolio
                  {summary.portfolioCount !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="mt-6 md:mt-0 flex gap-4 flex-wrap">
                <Link
                  href="/portfolios"
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                >
                  <i className="fas fa-chart-pie mr-2"></i>
                  Portfolios
                </Link>
                <Link
                  href="/brokers"
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                >
                  <i className="fas fa-building mr-2"></i>
                  Brokers
                </Link>
                <Link
                  href="/independence"
                  className="bg-linear-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 px-4 py-2 rounded-lg font-medium transition-colors flex items-center shadow-md"
                >
                  <i className="fas fa-umbrella-beach mr-2"></i>
                  Independence
                </Link>
              </div>
            </div>
          </div>

          {/* Independence Metrics - shown if user has an independence plan */}
          {primaryPlan && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => toggleSection("independence")}
                  className="flex items-center text-lg font-semibold text-gray-900 hover:text-gray-700"
                >
                  <i
                    className={`fas fa-chevron-${collapsedSections.independence ? "right" : "down"} text-gray-400 mr-2 w-4`}
                  ></i>
                  <i className="fas fa-chart-line text-green-500 mr-2"></i>
                  Independence Metrics
                  {projectionLoading && (
                    <span className="ml-2 inline-flex items-center">
                      <i className="fas fa-spinner fa-spin text-blue-500 text-sm"></i>
                      <span className="ml-1 text-sm font-normal text-gray-500">
                        Calculating...
                      </span>
                    </span>
                  )}
                </button>
                <Link
                  href={`/independence/plans/${primaryPlan.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View Plan →
                </Link>
              </div>

              {!collapsedSections.independence && (
                <div
                  className={`grid grid-cols-1 ${projectionData ? "sm:grid-cols-2 lg:grid-cols-4" : ""} gap-4`}
                >
                  {/* Monthly Investment Progress */}
                  <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">
                      Monthly Investment
                    </p>
                    {(() => {
                      // Monthly investment target = surplus × allocation %
                      // Surplus = working income - working expenses
                      const surplus =
                        (primaryPlan.workingIncomeMonthly ?? 0) -
                        (primaryPlan.workingExpensesMonthly ?? 0)
                      const target = Math.round(
                        surplus *
                          (primaryPlan.investmentAllocationPercent ?? 0.8),
                      )
                      const actual = Math.round(
                        monthlyInvestmentData?.totalInvested ?? 0,
                      )
                      const progress = target > 0 ? (actual / target) * 100 : 0
                      const currencySymbol = displayCurrency?.symbol || ""
                      const isNegative = actual < 0
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              !hideValues && setShowInvestmentModal(true)
                            }
                            className={`flex items-baseline gap-2 ${!hideValues ? "cursor-pointer hover:opacity-80" : ""}`}
                            disabled={hideValues}
                          >
                            {hideValues ? (
                              <span className="text-3xl font-bold text-gray-400">
                                ****
                              </span>
                            ) : (
                              <>
                                <span
                                  className={`text-3xl font-bold ${isNegative ? "text-red-600" : progress >= 100 ? "text-green-600" : "text-blue-600"}`}
                                >
                                  {isNegative ? "-" : ""}
                                  {currencySymbol}
                                  {Math.abs(actual).toLocaleString()}
                                </span>
                                <span className="text-sm text-gray-500">
                                  / {currencySymbol}
                                  {target.toLocaleString()}
                                </span>
                                <i className="fas fa-external-link-alt text-xs text-gray-400 ml-1"></i>
                              </>
                            )}
                          </button>
                          <div className="mt-2 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isNegative ? "bg-red-500" : progress >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                              style={{
                                width: `${Math.min(Math.max(progress, 0), 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {isNegative
                              ? "Net withdrawal this month"
                              : progress >= 100
                                ? "Target met!"
                                : `${progress.toFixed(0)}% of monthly target`}
                          </p>
                        </>
                      )
                    })()}
                  </div>

                  {/* FI Progress - show loading skeleton or data */}
                  {(projectionLoading || projectionData) && (
                    <div className="bg-linear-to-br from-green-50 to-emerald-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">FI Progress</p>
                      {projectionLoading && !projectionData ? (
                        <>
                          <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
                          <div className="mt-2 bg-gray-200 rounded-full h-2">
                            <div className="bg-gray-300 h-2 rounded-full w-0"></div>
                          </div>
                          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2"></div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-2">
                            {hideValues ? (
                              <span className="text-3xl font-bold text-gray-400">
                                ****
                              </span>
                            ) : (
                              <span className="text-3xl font-bold text-green-600">
                                {projectionData?.fiMetrics?.fiProgress?.toFixed(
                                  1,
                                ) ?? "0"}
                                %
                              </span>
                            )}
                          </div>
                          <div className="mt-2 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all"
                              style={{
                                width: hideValues
                                  ? "0%"
                                  : `${Math.min(projectionData?.fiMetrics?.fiProgress ?? 0, 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {hideValues
                              ? ""
                              : projectionData?.fiMetrics
                                    ?.isFinanciallyIndependent
                                ? "Financially Independent!"
                                : "Progress toward FI Number"}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Years to FI */}
                  {(projectionLoading || projectionData) && (
                    <div className="bg-linear-to-br from-orange-50 to-amber-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Years to FI</p>
                      {projectionLoading && !projectionData ? (
                        <>
                          <div className="h-9 w-16 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mt-2"></div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-2">
                            {hideValues ? (
                              <span className="text-3xl font-bold text-gray-400">
                                ****
                              </span>
                            ) : projectionData?.fiMetrics
                                ?.isFinanciallyIndependent ? (
                              <span className="text-2xl font-bold text-green-600">
                                FI Achieved!
                              </span>
                            ) : projectionData?.fiMetrics?.realYearsToFi !=
                              null ? (
                              <>
                                <span className="text-3xl font-bold text-orange-600">
                                  {Math.round(
                                    projectionData.fiMetrics.realYearsToFi,
                                  )}
                                </span>
                                <span className="text-sm text-gray-500">
                                  years
                                </span>
                              </>
                            ) : (
                              <span className="text-2xl font-bold text-gray-400">
                                —
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {hideValues
                              ? ""
                              : projectionData?.fiMetrics
                                    ?.isFinanciallyIndependent
                                ? "You've reached financial independence!"
                                : projectionData?.fiAchievementAge
                                  ? `FI at age ${projectionData.fiAchievementAge}`
                                  : "Keep investing to reach FIRE"}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Property Liquidation Age */}
                  {(projectionLoading || projectionData) && (
                    <div className="bg-linear-to-br from-purple-50 to-violet-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">
                        <i className="fas fa-home text-purple-400 mr-1"></i>
                        Property Sale Age
                      </p>
                      {projectionLoading && !projectionData ? (
                        <>
                          <div className="h-9 w-24 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2"></div>
                        </>
                      ) : (
                        (() => {
                          const liquidationYear =
                            projectionData?.yearlyProjections?.find(
                              (y) => y.propertyLiquidated,
                            )
                          const hasProperty =
                            (projectionData?.nonSpendableAtRetirement ?? 0) > 0
                          return (
                            <>
                              <div className="flex items-baseline gap-2">
                                {hideValues ? (
                                  <span className="text-3xl font-bold text-gray-400">
                                    ****
                                  </span>
                                ) : liquidationYear?.age ? (
                                  <>
                                    <span className="text-3xl font-bold text-purple-600">
                                      {liquidationYear.age}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      years old
                                    </span>
                                  </>
                                ) : hasProperty ? (
                                  <span className="text-2xl font-bold text-green-600">
                                    Not needed
                                  </span>
                                ) : (
                                  <span className="text-2xl font-bold text-gray-400">
                                    N/A
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                {hideValues
                                  ? ""
                                  : liquidationYear?.age
                                    ? "When liquid assets run low"
                                    : hasProperty
                                      ? "Liquid assets sufficient"
                                      : "No illiquid assets"}
                              </p>
                            </>
                          )
                        })()
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Charts Row */}
          {summary.portfolioBreakdown.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <button
                type="button"
                onClick={() => toggleSection("charts")}
                className="flex items-center text-lg font-semibold text-gray-900 hover:text-gray-700 mb-4"
              >
                <i
                  className={`fas fa-chevron-${collapsedSections.charts ? "right" : "down"} text-gray-400 mr-2 w-4`}
                ></i>
                <i className="fas fa-chart-pie text-blue-500 mr-2"></i>
                Asset Allocation
              </button>

              {!collapsedSections.charts && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Portfolio Breakdown Chart */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-medium text-gray-700 mb-4">
                      By Portfolio
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={portfolioChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {portfolioChartData.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              `${displayCurrency?.symbol}${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                              "Value",
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Asset Classification Breakdown Chart */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-medium text-gray-700 mb-4">
                      By Asset Classification
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={classificationChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {classificationChartData.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => {
                              const item = summary.classificationBreakdown.find(
                                (c) => c.classification === name,
                              )
                              return [
                                `${item?.percentage.toFixed(1) || 0}%`,
                                name,
                              ]
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Portfolio Details Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <button
                type="button"
                onClick={() => toggleSection("portfolioDetails")}
                className="flex items-center text-lg font-semibold text-gray-900 hover:text-gray-700"
              >
                <i
                  className={`fas fa-chevron-${collapsedSections.portfolioDetails ? "right" : "down"} text-gray-400 mr-2 w-4`}
                ></i>
                <i className="fas fa-table text-gray-500 mr-2"></i>
                Portfolio Details
              </button>
            </div>

            {!collapsedSections.portfolioDetails && (
              <>
                {summary.portfolioBreakdown.length === 0 ? (
                  <div className="p-8">
                    <p className="text-gray-600 mb-6 text-center">
                      {t("portfolios.empty.title", "No portfolios yet")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                      {/* Guided Setup */}
                      <Link
                        href="/onboarding"
                        className="border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <i className="fas fa-rocket text-blue-500"></i>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">
                          {t("home.startSetup", "Start Setup")}
                        </h4>
                        <p className="text-gray-500 text-xs">
                          {t("portfolios.guided", "Guided setup")}
                        </p>
                      </Link>
                      {/* Direct Add */}
                      <Link
                        href="/portfolios/__NEW__"
                        className="border border-gray-200 rounded-lg p-4 text-center hover:border-green-300 hover:shadow-sm transition-all"
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <i className="fas fa-plus text-green-500"></i>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">
                          {t("portfolio.create")}
                        </h4>
                        <p className="text-gray-500 text-xs">
                          {t("portfolios.direct", "Direct control")}
                        </p>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("code")}
                          >
                            <div className="flex items-center">
                              Portfolio
                              {getSortIcon("code")}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("value")}
                          >
                            <div className="flex items-center justify-end">
                              Value ({displayCurrency?.code})
                              {getSortIcon("value")}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("percentage")}
                          >
                            <div className="flex items-center justify-end">
                              % of Total
                              {getSortIcon("percentage")}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("irr")}
                          >
                            <div className="flex items-center justify-end">
                              IRR
                              {getSortIcon("irr")}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.portfolioBreakdown.map((portfolio, index) => (
                          <tr
                            key={portfolio.code}
                            className="hover:bg-slate-100 transition-colors cursor-pointer"
                            onClick={() =>
                              router.push(`/holdings/${portfolio.code}`)
                            }
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div
                                  className="w-3 h-3 rounded-full mr-3"
                                  style={{
                                    backgroundColor:
                                      COLORS[index % COLORS.length],
                                  }}
                                ></div>
                                <div>
                                  <Link
                                    href={`/holdings/${portfolio.code}`}
                                    className="font-medium text-blue-600 hover:text-blue-800"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {portfolio.code}
                                  </Link>
                                  <p className="text-sm text-gray-500">
                                    {portfolio.name}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                              {displayCurrency?.symbol}
                              <FormatValue value={portfolio.value} />
                            </td>
                            <td className="px-6 py-4 text-right text-gray-600">
                              {portfolio.percentage.toFixed(1)}%
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span
                                className={`font-medium ${portfolio.irr >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {(portfolio.irr * 100).toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                        <tr>
                          <td className="px-6 py-4 font-bold text-gray-900">
                            Total
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-900">
                            {displayCurrency?.symbol}
                            <FormatValue value={summary.totalValue} />
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-600">
                            100%
                          </td>
                          <td className="px-6 py-4"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/holdings/aggregated"
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-amber-200 transition-colors">
                  <i className="fas fa-layer-group text-amber-600 text-xl"></i>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    Aggregated Holdings
                  </p>
                  <p className="text-sm text-gray-500">
                    View all holdings combined
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/rebalance/wizard"
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-violet-200 transition-colors">
                  <i className="fas fa-balance-scale text-violet-600 text-xl"></i>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Rebalance</p>
                  <p className="text-sm text-gray-500">
                    Align to target allocations
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/accounts"
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-emerald-200 transition-colors">
                  <i className="fas fa-gem text-emerald-600 text-xl"></i>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Custom Assets</p>
                  <p className="text-sm text-gray-500">
                    Property, accounts & more
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Monthly Investment Transactions Modal */}
      {showInvestmentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setShowInvestmentModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Monthly Investment Transactions
                  </h3>
                  <p className="text-sm text-gray-500">
                    {monthlyInvestmentData?.yearMonth || "Current month"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvestmentModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
                {!investmentTrnsData ? (
                  <div className="flex justify-center py-8">
                    <i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
                  </div>
                ) : investmentTrnsData.data.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No investment transactions this month
                  </p>
                ) : (
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Asset
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {investmentTrnsData.data.map((trn) => (
                        <tr key={trn.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {trn.tradeDate}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                trn.trnType === "BUY"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {trn.trnType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {trn.asset?.code || trn.asset?.name || "Unknown"}
                          </td>
                          <td
                            className={`px-3 py-2 text-sm text-right font-medium ${
                              trn.trnType === "BUY"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {trn.trnType === "SELL" ? "-" : ""}
                            {trn.tradeCurrency?.symbol}
                            {Math.abs(trn.tradeAmount).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-2 text-sm font-semibold text-gray-900"
                        >
                          Net Total ({displayCurrency?.code})
                        </td>
                        <td
                          className={`px-3 py-2 text-sm text-right font-bold ${
                            (monthlyInvestmentData?.totalInvested ?? 0) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {(monthlyInvestmentData?.totalInvested ?? 0) < 0
                            ? "-"
                            : ""}
                          {displayCurrency?.symbol}
                          {Math.abs(
                            monthlyInvestmentData?.totalInvested ?? 0,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                Shows BUY and SELL transactions only. ADD/transfers are
                excluded.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default withPageAuthRequired(WealthDashboard)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
