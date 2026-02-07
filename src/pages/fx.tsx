import React, { useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr from "swr"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import {
  Currency,
  FxProvidersResponse,
  FxRequest,
  FxResponse,
} from "types/beancounter"
import { useIsAdmin } from "@hooks/useIsAdmin"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

// Provider display names and colors
const PROVIDER_CONFIG: Record<
  string,
  { name: string; color: string; bg: string }
> = {
  FRANKFURTER: {
    name: "Frankfurter",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
  EXCHANGE_RATES_API: {
    name: "ExchangeRates",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
}

// Time range options for chart
const TIME_RANGES = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
]

// Fetcher for FX rates using POST
const fxFetcher = async (
  url: string,
  pairs: Array<{ from: string; to: string }>,
  provider?: string,
): Promise<FxResponse> => {
  const body: FxRequest = { pairs }
  if (provider) {
    body.provider = provider
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch FX rates: ${response.status}`)
  }
  return response.json()
}

// Rate color based on value (rates close to 1 are neutral, higher/lower have gradient)
const getRateColor = (rate: number): string => {
  if (rate === 1) return "text-gray-400"
  if (rate > 1.5) return "text-rose-600"
  if (rate > 1.2) return "text-orange-500"
  if (rate > 1) return "text-amber-500"
  if (rate > 0.8) return "text-sky-500"
  if (rate > 0.5) return "text-blue-600"
  return "text-indigo-600"
}

// FX History Response type
interface FxHistoryResponse {
  from: string
  to: string
  startDate: string
  endDate: string
  data: Array<{ date: string; rate: number }>
}

// Rate History Chart Modal Component
interface RateChartModalProps {
  from: string
  to: string
  onClose: () => void
}

const RateChartModal: React.FC<RateChartModalProps> = ({
  from: initialFrom,
  to: initialTo,
  onClose,
}) => {
  const [months, setMonths] = useState(3)
  const [isInverted, setIsInverted] = useState(false)

  // Swap currencies when inverted
  const from = isInverted ? initialTo : initialFrom
  const to = isInverted ? initialFrom : initialTo

  const { data, isLoading, error } = useSwr<FxHistoryResponse>(
    `/api/fx/history?from=${from}&to=${to}&months=${months}`,
    simpleFetcher(`/api/fx/history?from=${from}&to=${to}&months=${months}`),
  )

  const chartData = data?.data || []

  // Calculate stats
  const stats = useMemo(() => {
    const rateData = data?.data || []
    if (rateData.length === 0) return null
    const rates = rateData.map((d) => d.rate)
    const min = Math.min(...rates)
    const max = Math.max(...rates)
    const current = rates[rates.length - 1]
    const first = rates[0]
    const change = current - first
    const changePercent = (change / first) * 100
    return { min, max, current, change, changePercent }
  }, [data?.data])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto z-50 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span>{from}</span>
                  <button
                    onClick={() => setIsInverted(!isInverted)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-all hover:scale-110"
                    title="Swap currencies"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </button>
                  <span>{to}</span>
                </h2>
                <p className="text-blue-100 text-sm">Historical rate chart</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Time range selector */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.label}
                onClick={() => setMonths(range.months)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  months === range.months
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <span
                className={`font-medium ${stats.change >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {stats.change >= 0 ? "+" : ""}
                {stats.changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Chart area */}
        <div className="p-6">
          {isLoading && (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="h-64 flex items-center justify-center text-red-500">
              Failed to load rate history
            </div>
          )}

          {!isLoading && !error && chartData.length > 0 && (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(date: string) => {
                        const d = new Date(date)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(value: number) => value.toFixed(3)}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                      labelFormatter={(label) =>
                        new Date(String(label)).toLocaleDateString()
                      }
                      formatter={(value) =>
                        value !== undefined
                          ? [Number(value).toFixed(4), "Rate"]
                          : ["", ""]
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: "#3b82f6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              {stats && (
                <div className="mt-4 grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      Current
                    </div>
                    <div className="text-lg font-bold text-slate-900 font-mono">
                      {stats.current.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      High
                    </div>
                    <div className="text-lg font-bold text-green-600 font-mono">
                      {stats.max.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      Low
                    </div>
                    <div className="text-lg font-bold text-red-600 font-mono">
                      {stats.min.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      Change
                    </div>
                    <div
                      className={`text-lg font-bold font-mono ${stats.change >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {stats.change >= 0 ? "+" : ""}
                      {stats.change.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default withPageAuthRequired(function FxMatrix(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const { isAdmin } = useIsAdmin()
  const [compareMode, setCompareMode] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(
    undefined,
  )
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null)
  const [chartPair, setChartPair] = useState<{
    from: string
    to: string
  } | null>(null)

  // Fetch available currencies
  const ccyResponse = useSwr<{ data: Currency[] }>(
    ccyKey,
    simpleFetcher(ccyKey),
  )

  // Fetch available providers
  const providersResponse = useSwr<FxProvidersResponse>(
    "/api/fx/providers",
    simpleFetcher("/api/fx/providers"),
  )

  // Generate all currency pairs when currencies are loaded
  const currencyPairs = useMemo(() => {
    if (!ccyResponse.data?.data) return []
    const currencies = ccyResponse.data.data
    const pairs: Array<{ from: string; to: string }> = []

    for (const from of currencies) {
      for (const to of currencies) {
        if (from.code !== to.code) {
          pairs.push({ from: from.code, to: to.code })
        }
      }
    }
    return pairs
  }, [ccyResponse.data?.data])

  // Fetch FX rates for selected provider (or default)
  const fxKey =
    currencyPairs.length > 0
      ? ["/api/fx", currencyPairs, selectedProvider]
      : null
  const fxResponse = useSwr<FxResponse>(
    fxKey,
    ([url, pairs]: [string, Array<{ from: string; to: string }>, string?]) =>
      fxFetcher(url, pairs, selectedProvider),
  )

  // Fetch rates from all providers when in compare mode
  const providers = providersResponse.data?.providers || []
  const provider1 = providers[0]
  const provider2 = providers[1]

  const fxResponse1 = useSwr<FxResponse>(
    compareMode && currencyPairs.length > 0 && provider1
      ? ["/api/fx", currencyPairs, provider1, "p1"]
      : null,
    ([url, pairs]: [
      string,
      Array<{ from: string; to: string }>,
      string,
      string,
    ]) => fxFetcher(url, pairs, provider1),
  )

  const fxResponse2 = useSwr<FxResponse>(
    compareMode && currencyPairs.length > 0 && provider2
      ? ["/api/fx", currencyPairs, provider2, "p2"]
      : null,
    ([url, pairs]: [
      string,
      Array<{ from: string; to: string }>,
      string,
      string,
    ]) => fxFetcher(url, pairs, provider2),
  )

  // Loading states
  if (!ready || ccyResponse.isLoading) {
    return rootLoader(t("loading"))
  }

  // Error handling
  if (ccyResponse.error) {
    return errorOut(t("fx.error.currencies"), ccyResponse.error)
  }

  if (fxResponse.error && !compareMode) {
    return errorOut(t("fx.error.rates"), fxResponse.error)
  }

  const currencies = ccyResponse.data?.data || []
  const rates = fxResponse.data?.data?.rates || {}
  const rates1 = fxResponse1.data?.data?.rates || {}
  const rates2 = fxResponse2.data?.data?.rates || {}

  // Get rate for a currency pair
  const getRate = (
    from: string,
    to: string,
    ratesMap: Record<string, { rate: number; date: string }>,
  ): number | null => {
    if (from === to) return 1
    const key = `${from}:${to}`
    return ratesMap[key]?.rate ?? null
  }

  // Format rate display
  const formatRate = (rate: number | null): string => {
    if (rate === null) return "-"
    return rate.toFixed(4)
  }

  // Calculate difference between two rates
  const getDiff = (
    from: string,
    to: string,
  ): { diff: number; percent: number } | null => {
    if (from === to) return null
    const key = `${from}:${to}`
    const rate1 = rates1[key]
    const rate2 = rates2[key]
    if (!rate1 || !rate2) return null
    const diff = rate1.rate - rate2.rate
    const percent = (diff / rate2.rate) * 100
    return { diff, percent }
  }

  // Get rate date from first available rate
  const rateDate = Object.values(rates)[0]?.date || ""
  const rateDate1 = Object.values(rates1)[0]?.date || ""
  const rateDate2 = Object.values(rates2)[0]?.date || ""

  const isLoading =
    fxResponse.isLoading ||
    (compareMode && (fxResponse1.isLoading || fxResponse2.isLoading))

  // Clickable rate component
  const ClickableRate: React.FC<{
    from: string
    to: string
    rate: number | null
    className?: string
  }> = ({ from, to, rate, className = "" }) => (
    <button
      onClick={() => setChartPair({ from, to })}
      className={`font-mono hover:underline hover:decoration-blue-400 cursor-pointer transition-all ${className}`}
      title={`Click to view ${from}/${to} history`}
    >
      {formatRate(rate)}
    </button>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Rate History Chart Modal */}
      {chartPair && (
        <RateChartModal
          from={chartPair.from}
          to={chartPair.to}
          onClose={() => setChartPair(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {t("fx.title")}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {rateDate && !compareMode && (
                  <span>
                    {t("fx.asOf")} {rateDate}
                  </span>
                )}
                {!rateDate && t("fx.description")}
              </p>
            </div>

            {/* Admin-only provider controls */}
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                {/* Provider selector (single mode) */}
                {!compareMode && providers.length > 0 && (
                  <select
                    value={selectedProvider || ""}
                    onChange={(e) =>
                      setSelectedProvider(e.target.value || undefined)
                    }
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Auto (Cached)</option>
                    {providers.map((p) => (
                      <option key={p} value={p}>
                        {PROVIDER_CONFIG[p]?.name || p}
                      </option>
                    ))}
                  </select>
                )}

                {/* Compare mode toggle */}
                {providers.length >= 2 && (
                  <button
                    onClick={() => {
                      setCompareMode(!compareMode)
                      if (!compareMode) setSelectedProvider(undefined)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      compareMode
                        ? "bg-blue-600 text-white shadow-md hover:bg-blue-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="hidden sm:inline">Compare Providers</span>
                    <span className="sm:hidden">Compare</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Compare mode legend */}
          {compareMode && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-slate-600">
                  {PROVIDER_CONFIG[provider1]?.name || provider1}
                  {rateDate1 && (
                    <span className="text-slate-400 ml-1">({rateDate1})</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">
                  {PROVIDER_CONFIG[provider2]?.name || provider2}
                  {rateDate2 && (
                    <span className="text-slate-400 ml-1">({rateDate2})</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Rate color legend */}
          {!compareMode && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-2">Rate colors:</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <span className="text-slate-500">&lt;0.5 (Strong)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span className="text-slate-500">0.5-0.8</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span className="text-slate-500">0.8-1.0</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  <span className="text-slate-500">1.0 (Parity)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-slate-500">1.0-1.2</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="text-slate-500">1.2-1.5</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                  <span className="text-slate-500">&gt;1.5 (Weak)</span>
                </span>
              </div>
            </div>
          )}

          {/* Hint */}
          <div className="mt-3 text-xs text-slate-400">
            Click any rate to view historical chart
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-500 mt-4">{t("fx.loading")}</p>
          </div>
        )}

        {/* Mobile Card View */}
        {!isLoading && (
          <div className="block lg:hidden space-y-4">
            {/* Currency selector for mobile */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Convert from:
              </label>
              <div className="flex flex-wrap gap-2">
                {currencies.map((ccy) => (
                  <button
                    key={ccy.code}
                    onClick={() =>
                      setSelectedFrom(
                        selectedFrom === ccy.code ? null : ccy.code,
                      )
                    }
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedFrom === ccy.code
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="mr-1">{ccy.symbol}</span>
                    {ccy.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile rate cards */}
            {selectedFrom && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {currencies
                  .filter((c) => c.code !== selectedFrom)
                  .map((toCcy) => {
                    const rate = getRate(selectedFrom, toCcy.code, rates)
                    const inverseRate = getRate(toCcy.code, selectedFrom, rates)
                    const diffData = compareMode
                      ? getDiff(selectedFrom, toCcy.code)
                      : null

                    return (
                      <div
                        key={toCcy.code}
                        className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-slate-900">
                            {toCcy.code}
                          </span>
                          <span className="text-slate-400 text-sm">
                            {toCcy.symbol}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 mb-2">
                          {toCcy.name}
                        </div>

                        {compareMode ? (
                          <div className="space-y-2">
                            {/* Forward rates */}
                            <div className="text-xs text-slate-400 mb-1">
                              1 {selectedFrom} =
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <ClickableRate
                                  from={selectedFrom}
                                  to={toCcy.code}
                                  rate={getRate(
                                    selectedFrom,
                                    toCcy.code,
                                    rates1,
                                  )}
                                  className="text-blue-700 font-medium"
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <ClickableRate
                                  from={selectedFrom}
                                  to={toCcy.code}
                                  rate={getRate(
                                    selectedFrom,
                                    toCcy.code,
                                    rates2,
                                  )}
                                  className="text-emerald-700 font-medium"
                                />
                              </div>
                            </div>
                            {/* Inverse rates */}
                            <div className="pt-2 border-t border-slate-100">
                              <div className="text-xs text-slate-400 mb-1">
                                1 {toCcy.code} =
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                  <button
                                    onClick={() =>
                                      setChartPair({
                                        from: toCcy.code,
                                        to: selectedFrom,
                                      })
                                    }
                                    className="text-blue-700 font-mono text-sm hover:underline"
                                  >
                                    {formatRate(
                                      getRate(toCcy.code, selectedFrom, rates1),
                                    )}{" "}
                                    {selectedFrom}
                                  </button>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                  <button
                                    onClick={() =>
                                      setChartPair({
                                        from: toCcy.code,
                                        to: selectedFrom,
                                      })
                                    }
                                    className="text-emerald-700 font-mono text-sm hover:underline"
                                  >
                                    {formatRate(
                                      getRate(toCcy.code, selectedFrom, rates2),
                                    )}{" "}
                                    {selectedFrom}
                                  </button>
                                </div>
                              </div>
                            </div>
                            {diffData && Math.abs(diffData.percent) > 0.001 && (
                              <div
                                className={`text-xs text-right ${diffData.diff > 0 ? "text-blue-600" : "text-emerald-600"}`}
                              >
                                {diffData.diff > 0 ? "+" : ""}
                                {diffData.percent.toFixed(3)}%
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Forward rate */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">
                                1 {selectedFrom} =
                              </span>
                              <ClickableRate
                                from={selectedFrom}
                                to={toCcy.code}
                                rate={rate}
                                className={`text-lg font-bold ${rate ? getRateColor(rate) : "text-slate-400"}`}
                              />
                            </div>
                            {/* Inverse rate */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="text-xs text-slate-400">
                                1 {toCcy.code} =
                              </span>
                              <button
                                onClick={() =>
                                  setChartPair({
                                    from: toCcy.code,
                                    to: selectedFrom,
                                  })
                                }
                                className={`text-sm font-mono hover:underline ${inverseRate ? getRateColor(inverseRate) : "text-slate-400"}`}
                              >
                                {formatRate(inverseRate)} {selectedFrom}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {!selectedFrom && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                Select a currency above to see exchange rates
              </div>
            )}
          </div>
        )}

        {/* Desktop Matrix View */}
        {!isLoading && (
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                      {t("fx.from")} / {t("fx.to")}
                    </th>
                    {currencies.map((ccy) => (
                      <th
                        key={ccy.code}
                        className="px-3 py-3 text-center border-b border-slate-200 min-w-[100px]"
                        title={ccy.name}
                      >
                        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          {ccy.code}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {ccy.symbol}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((fromCcy, rowIndex) => (
                    <tr
                      key={fromCcy.code}
                      className={`hover:bg-blue-50/50 transition-colors ${rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                    >
                      <td
                        className="px-4 py-3 border-b border-r border-slate-200 sticky left-0 bg-inherit z-10"
                        title={fromCcy.name}
                      >
                        <div className="font-semibold text-slate-900">
                          {fromCcy.code}
                        </div>
                        <div className="text-xs text-slate-400">
                          {fromCcy.name}
                        </div>
                      </td>
                      {currencies.map((toCcy) => {
                        const isDiagonal = fromCcy.code === toCcy.code
                        const rate = getRate(fromCcy.code, toCcy.code, rates)
                        const diffData = compareMode
                          ? getDiff(fromCcy.code, toCcy.code)
                          : null

                        if (isDiagonal) {
                          return (
                            <td
                              key={`${fromCcy.code}-${toCcy.code}`}
                              className="px-3 py-2 border-b border-slate-200 text-center bg-slate-100"
                            >
                              <span className="text-slate-400 font-mono text-sm">
                                1.0000
                              </span>
                            </td>
                          )
                        }

                        return (
                          <td
                            key={`${fromCcy.code}-${toCcy.code}`}
                            className="px-3 py-2 border-b border-slate-200 text-center"
                          >
                            {compareMode ? (
                              <div className="space-y-0.5">
                                <ClickableRate
                                  from={fromCcy.code}
                                  to={toCcy.code}
                                  rate={getRate(
                                    fromCcy.code,
                                    toCcy.code,
                                    rates1,
                                  )}
                                  className="text-blue-700 text-sm bg-blue-50 rounded px-1 block"
                                />
                                <ClickableRate
                                  from={fromCcy.code}
                                  to={toCcy.code}
                                  rate={getRate(
                                    fromCcy.code,
                                    toCcy.code,
                                    rates2,
                                  )}
                                  className="text-emerald-700 text-sm bg-emerald-50 rounded px-1 block"
                                />
                                {diffData &&
                                  Math.abs(diffData.percent) > 0.001 && (
                                    <div
                                      className={`text-[10px] font-medium ${diffData.diff > 0 ? "text-blue-600" : "text-emerald-600"}`}
                                    >
                                      {diffData.diff > 0 ? "+" : ""}
                                      {diffData.percent.toFixed(3)}%
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <ClickableRate
                                from={fromCcy.code}
                                to={toCcy.code}
                                rate={rate}
                                className={`text-sm font-medium ${rate ? getRateColor(rate) : "text-slate-400"}`}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>{t("fx.description")}</p>
          {compareMode && (
            <p className="mt-2">
              Differences show which provider returns higher rates for each
              pair.
            </p>
          )}
        </div>
      </div>
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
