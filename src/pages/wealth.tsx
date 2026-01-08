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
} from "types/beancounter"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import { FormatValue } from "@components/ui/MoneyUtils"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
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
  const router = useRouter()
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "value",
    direction: "desc",
  })

  // Fetch portfolios
  const {
    data: portfolioData,
    error: portfolioError,
    isLoading: portfolioLoading,
  } = useSwr(portfoliosKey, simpleFetcher(portfoliosKey))

  // Fetch aggregated holdings for asset classification breakdown
  const holdingKeyUrl = holdingKey("aggregated", "today")
  const { data: holdingsData } = useSwr<{ data: HoldingContract }>(
    holdingKeyUrl,
    simpleFetcher(holdingKeyUrl),
  )

  // Fetch currencies
  const { data: currencyData } = useSwr<{ data: Currency[] }>(
    ccyKey,
    simpleFetcher(ccyKey),
  )

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

  // Fetch FX rates for all portfolio currencies
  useEffect(() => {
    if (!displayCurrency || portfolios.length === 0) return

    const uniqueCurrencies = [
      ...new Set(portfolios.map((p) => p.currency.code)),
    ]
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
      const marketValue = portfolio.marketValue || 0
      const rate = fxRates[portfolio.currency.code] || 1
      const convertedValue = marketValue * rate

      totalValue += convertedValue

      portfolioValues.push({
        code: portfolio.code,
        name: portfolio.name,
        value: convertedValue,
        irr: portfolio.irr || 0,
      })
    })

    // Calculate asset classification breakdown from holdings
    const classificationTotals: Record<string, number> = {}
    if (holdingsData?.data?.positions) {
      Object.values(holdingsData.data.positions).forEach((position) => {
        let classification =
          position.asset?.assetCategory?.name || "Uncategorised"
        // Merge "Bank Account" into "Cash" as they represent the same thing
        if (classification === "Bank Account") {
          classification = "Cash"
        }
        const positionValue = position.moneyValues?.BASE?.marketValue || 0
        classificationTotals[classification] =
          (classificationTotals[classification] || 0) + positionValue
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
      portfolioCount: portfolios.length,
      classificationBreakdown,
      portfolioBreakdown,
    }
  }, [portfolios, fxRates, sortConfig, holdingsData])

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

  if (portfolioLoading || !ready) {
    return rootLoader(t("loading"))
  }

  return (
    <>
      <Head>
        <title>Net Worth | Holdsworth</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-6">
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
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 mb-8 text-white">
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
                <p className="text-blue-200 mt-2">
                  Across {summary.portfolioCount} portfolio
                  {summary.portfolioCount !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="mt-6 md:mt-0 flex gap-4">
                <Link
                  href="/portfolios"
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                >
                  <i className="fas fa-chart-pie mr-2"></i>
                  Portfolios
                </Link>
                <Link
                  href="/retire"
                  className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 px-4 py-2 rounded-lg font-medium transition-colors flex items-center shadow-md"
                >
                  <i className="fas fa-umbrella-beach mr-2"></i>
                  Plan Retirement
                </Link>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          {summary.portfolioBreakdown.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Portfolio Breakdown Chart */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  By Portfolio
                </h2>
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
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  By Asset Classification
                </h2>
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
                          return [`${item?.percentage.toFixed(1) || 0}%`, name]
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Portfolio Details Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Portfolio Details
              </h2>
            </div>

            {summary.portfolioBreakdown.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-chart-pie text-2xl text-gray-400"></i>
                </div>
                <p className="text-gray-600 mb-4">No portfolios yet</p>
                <Link
                  href="/portfolios/__NEW__"
                  className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Create Portfolio
                </Link>
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
                          Value ({displayCurrency?.code}){getSortIcon("value")}
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
                                backgroundColor: COLORS[index % COLORS.length],
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
    </>
  )
}

export default withPageAuthRequired(WealthDashboard)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
