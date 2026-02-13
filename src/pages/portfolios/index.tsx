import React, { useState, useMemo, useCallback, useEffect } from "react"
import useSwr from "swr"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import type { User } from "@auth0/nextjs-auth0/types"
import { useTranslation } from "next-i18next"
import { Portfolio, Currency } from "types/beancounter"
import Link from "next/link"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import { FormatValue } from "@components/ui/MoneyUtils"
import { QuickTooltip } from "@components/ui/Tooltip"
import PortfolioCorporateActionsPopup from "@components/features/portfolios/PortfolioCorporateActionsPopup"
import ManagedPortfolios from "@components/features/portfolios/ManagedPortfolios"
import { useFxRates } from "@hooks/useFxRates"
import ShareInviteDialog from "@components/features/portfolios/ShareInviteDialog"
import PortfolioActions from "@components/features/portfolios/PortfolioActions"
import PortfolioImportDialog from "@components/features/portfolios/PortfolioImportDialog"

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

export default withPageAuthRequired(function Portfolios({
  user,
}: {
  user: User
}): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const router = useRouter()
  const { data, mutate, error } = useSwr(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Sort configuration state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "code",
    direction: "asc",
  })

  // Multi-select state for Analyze functionality
  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<string>>(
    new Set(),
  )

  // Corporate actions popup state
  const [corporateActionsPortfolio, setCorporateActionsPortfolio] =
    useState<Portfolio | null>(null)

  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Share dialog state - null=closed, undefined=open with no preselection, string=open with preselected portfolio ID
  const [sharePortfolioId, setSharePortfolioId] = useState<
    string | undefined | null
  >(null)

  // Tab state - read from query param, default to "my"
  const activeTab = (router.query.tab as string) === "managed" ? "managed" : "my"
  const setActiveTab = useCallback(
    (tab: "my" | "managed") => {
      router.replace(
        { pathname: router.pathname, query: tab === "my" ? {} : { tab } },
        undefined,
        { shallow: true },
      )
    },
    [router],
  )

  // Currency display state
  const [currencies, setCurrencies] = useState<Currency[]>([])

  // Fetch available currencies
  useEffect(() => {
    fetch("/api/currencies")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setCurrencies(data.data)
        }
      })
      .catch(console.error)
  }, [])

  // FX rates for converting portfolio values to display currency
  const sourceCurrencyCodes = useMemo(
    () => (data?.data || []).map((p: Portfolio) => p.base.code),
    [data?.data],
  )
  const {
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    fxReady: fxRatesReady,
  } = useFxRates(currencies, sourceCurrencyCodes)

  const handleCorporateActionsClose = useCallback(() => {
    setCorporateActionsPortfolio(null)
  }, [])

  const handleImportClick = useCallback(() => {
    setShowImportDialog(true)
  }, [])

  const handleShareClick = useCallback((portfolioId?: string) => {
    setSharePortfolioId(portfolioId ?? undefined)
  }, [])

  const handleImportClose = useCallback(() => {
    setShowImportDialog(false)
  }, [])

  const handleImportComplete = useCallback(async () => {
    await mutate()
    setShowImportDialog(false)
  }, [mutate])

  // Toggle portfolio selection for multi-select
  const togglePortfolioSelection = useCallback((code: string) => {
    setSelectedPortfolios((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(code)) {
        newSet.delete(code)
      } else {
        newSet.add(code)
      }
      return newSet
    })
  }, [])

  // Toggle all portfolios selection
  const toggleAllSelection = useCallback(() => {
    if (!data?.data) return
    setSelectedPortfolios((prev) => {
      if (prev.size === data.data.length) {
        return new Set()
      }
      return new Set(data.data.map((p: Portfolio) => p.code))
    })
  }, [data?.data])

  // Navigate to aggregated holdings view with selected portfolios
  const handleViewAggregated = useCallback(() => {
    if (selectedPortfolios.size === 0) return
    const codes = Array.from(selectedPortfolios).join(",")
    router.push(`/holdings/aggregated?codes=${encodeURIComponent(codes)}`)
  }, [selectedPortfolios, router])

  // Handle sorting
  const handleSort = (key: string): void => {
    setSortConfig((prevConfig) => {
      if (prevConfig.key === key) {
        // Toggle direction for the same column
        return {
          key,
          direction: prevConfig.direction === "asc" ? "desc" : "asc",
        }
      }
      // New column clicked - start with DESC for better UX (except for code which should be ASC)
      return {
        key,
        direction: key === "code" ? "asc" : "desc",
      }
    })
  }

  // Sort portfolios
  const sortedPortfolios = useMemo(() => {
    if (!data?.data) return []

    const portfolios = [...data.data]
    if (!sortConfig.key) return portfolios

    return portfolios.sort((a, b) => {
      let aValue: string | number = ""
      let bValue: string | number = ""

      switch (sortConfig.key) {
        case "code":
          aValue = a.code.toLowerCase()
          bValue = b.code.toLowerCase()
          break
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "currency":
          aValue = a.currency.code.toLowerCase()
          bValue = b.currency.code.toLowerCase()
          break
        case "base":
          aValue = a.base.code.toLowerCase()
          bValue = b.base.code.toLowerCase()
          break
        case "marketValue":
          aValue = a.marketValue || 0
          bValue = b.marketValue || 0
          break
        case "irr":
          aValue = a.irr || 0
          bValue = b.irr || 0
          break
        case "gainOnDay":
          aValue = a.gainOnDay || 0
          bValue = b.gainOnDay || 0
          break
        case "gainOnDayPercent": {
          const aPrev = (a.marketValue || 0) - (a.gainOnDay || 0)
          aValue = aPrev !== 0 ? (a.gainOnDay || 0) / aPrev : 0
          const bPrev = (b.marketValue || 0) - (b.gainOnDay || 0)
          bValue = bPrev !== 0 ? (b.gainOnDay || 0) / bPrev : 0
          break
        }
        case "valuedAt":
          aValue = a.valuedAt || ""
          bValue = b.valuedAt || ""
          break
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        const result = aValue.localeCompare(bValue)
        return sortConfig.direction === "asc" ? result : -result
      }
      const result = (aValue as number) - (bValue as number)
      return sortConfig.direction === "asc" ? result : -result
    })
  }, [data?.data, sortConfig.key, sortConfig.direction])

  if (error) {
    return errorOut(t("portfolios.error.retrieve"), error)
  }

  if (!user) {
    return rootLoader(t("loading"))
  }

  async function deletePortfolio(
    portfolioId: string,
    message: string,
  ): Promise<void> {
    if (window.confirm(message)) {
      try {
        await fetch(`/api/portfolios/${portfolioId}`, {
          method: "DELETE",
        })
        await mutate() // Revalidate to refresh the list
      } catch (error) {
        console.error("Failed to delete portfolio:", error)
      }
    }
  }

  // Sort icon component - styled for wealth blue header
  const getSortIcon = (headerKey: string): React.ReactElement => {
    if (!sortConfig || sortConfig.key !== headerKey) {
      return <span className="ml-1 text-wealth-200/60">↕</span>
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-white font-bold">↑</span>
    ) : (
      <span className="ml-1 text-white font-bold">↓</span>
    )
  }

  // Check if valuation date is stale (not today)
  const isStale = (valuedAt: string | undefined): boolean => {
    if (!valuedAt) return true
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    return valuedAt !== today
  }

  // Format the valued at date for display
  const formatValuedAt = (valuedAt: string | undefined): string => {
    if (!valuedAt) return "-"
    const date = new Date(valuedAt)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  }

  // Format the lastUpdated timestamp for tooltip (in user's local timezone)
  const formatLastUpdated = (lastUpdated: string | undefined): string => {
    if (!lastUpdated) return ""
    const date = new Date(lastUpdated)
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  function listPortfolios(portfolios: Portfolio[]): React.ReactElement {
    if (!portfolios || portfolios.length == 0) {
      return (
        <div className="min-h-screen bg-gray-50 px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
              {t("portfolios.empty.title", "No portfolios yet")}
            </h2>
            <p className="text-gray-600 mb-8 text-center">
              {t("error.portfolios.empty")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Guided Setup - for novice users */}
              <Link
                href="/onboarding"
                className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm hover:border-wealth-200 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-wealth-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-rocket text-xl text-wealth-500"></i>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("home.startSetup", "Start Setup")}
                </h3>
                <p className="text-gray-500 text-sm">
                  {t(
                    "portfolios.guided",
                    "Guided setup for bank accounts, property, and pensions",
                  )}
                </p>
              </Link>

              {/* Direct Add - for professional users */}
              <Link
                href="/portfolios/__NEW__"
                className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm hover:border-green-300 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-plus text-xl text-green-500"></i>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("portfolio.create")}
                </h3>
                <p className="text-gray-500 text-sm">
                  {t(
                    "portfolios.direct",
                    "Create a portfolio directly with full control",
                  )}
                </p>
              </Link>
            </div>
          </div>
        </div>
      )
    }

    // Calculate total market value with FX conversion
    // marketValue is stored in portfolio.base currency, convert to displayCurrency
    const totalMarketValue = portfolios.reduce(
      (sum, p) => sum + (p.marketValue || 0) * (fxRates[p.base.code] || 1),
      0,
    )

    // Calculate total gain on day with FX conversion
    const totalGainOnDay = portfolios.reduce(
      (sum, p) => sum + (p.gainOnDay || 0) * (fxRates[p.base.code] || 1),
      0,
    )

    const allSelected =
      portfolios.length > 0 && selectedPortfolios.size === portfolios.length

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-4">
            {/* Title row */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => router.push("/wealth")}
                  className="text-gray-500 hover:text-gray-700 p-1 -ml-1"
                  title={t("wealth.title", "Wealth")}
                >
                  <i className="fas fa-arrow-left text-lg"></i>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {t("portfolios.title", "Portfolios")}
                </h1>
                {currencies.length > 0 && displayCurrency && (
                  <select
                    value={displayCurrency.code}
                    onChange={(e) => {
                      const selected = currencies.find(
                        (c) => c.code === e.target.value,
                      )
                      if (selected) setDisplayCurrency(selected)
                    }}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    title={t("portfolios.currency.display")}
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} {c.code}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <PortfolioActions onImportClick={handleImportClick} onShareClick={() => handleShareClick()} />
            </div>

            {/* Selection actions - only show when portfolios selected */}
            {selectedPortfolios.size > 0 && (
              <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-600">
                  {selectedPortfolios.size} {t("selected")}
                </span>
                <button
                  className="bg-amber-500 text-white py-1.5 px-3 rounded-lg hover:bg-amber-600 transition-colors flex items-center text-sm"
                  onClick={handleViewAggregated}
                >
                  <i className="fas fa-layer-group mr-1.5"></i>
                  {t("portfolios.viewHoldings", "Holdings")}
                </button>
                <button
                  className="bg-indigo-500 text-white py-1.5 px-3 rounded-lg hover:bg-indigo-600 transition-colors flex items-center text-sm"
                  onClick={() => {
                    const codes = Array.from(selectedPortfolios).join(",")
                    router.push(
                      `/rebalance/wizard?portfolios=${encodeURIComponent(codes)}`,
                    )
                  }}
                >
                  <i className="fas fa-balance-scale mr-1.5"></i>
                  {t("portfolios.rebalance", "Rebalance")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Card layout */}
        <div className="md:hidden px-4 py-4 space-y-3">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                selectedPortfolios.has(portfolio.code)
                  ? "border-wealth-200 bg-wealth-50"
                  : "border-gray-200"
              }`}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => router.push(`/holdings/${portfolio.code}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedPortfolios.has(portfolio.code)}
                      onChange={() => togglePortfolioSelection(portfolio.code)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-wealth-600">
                        {portfolio.code}
                      </div>
                      <div className="text-gray-900">{portfolio.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {displayCurrency?.symbol === "?"
                        ? displayCurrency?.code
                        : displayCurrency?.symbol}
                      <FormatValue
                        value={
                          (portfolio.marketValue ? portfolio.marketValue : 0) *
                          (fxRates[portfolio.base.code] || 1)
                        }
                      />
                    </div>
                    {portfolio.gainOnDay !== undefined &&
                      portfolio.gainOnDay !== 0 &&
                      portfolio.marketValue && (
                        <QuickTooltip
                          text={`${portfolio.gainOnDay >= 0 ? "+" : ""}${displayCurrency?.code || ""} ${(portfolio.gainOnDay * (fxRates[portfolio.base.code] || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        >
                          <span
                            className={`text-sm font-medium tabular-nums ${
                              portfolio.gainOnDay >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {(
                              (portfolio.gainOnDay /
                                (portfolio.marketValue - portfolio.gainOnDay)) *
                              100
                            ).toFixed(2)}
                            %
                          </span>
                        </QuickTooltip>
                      )}
                    <div
                      className={`text-sm font-medium tabular-nums ${
                        (portfolio.irr || 0) >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      <FormatValue
                        value={portfolio.irr}
                        multiplier={100}
                        isPublic
                      />
                      %
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <span>
                      {portfolio.base.symbol}
                      {portfolio.base.code}
                    </span>
                    {isStale(portfolio.valuedAt) && (
                      <span
                        className="text-amber-500"
                        title={`Valued: ${formatValuedAt(portfolio.valuedAt)}${portfolio.lastUpdated ? ` (Updated: ${formatLastUpdated(portfolio.lastUpdated)})` : ""}`}
                      >
                        <i className="fas fa-clock text-xs"></i>
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center space-x-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleShareClick(portfolio.id)}
                      className="text-blue-500 hover:text-blue-700 p-1"
                      title={t("shares.share")}
                    >
                      <i className="fas fa-share-alt"></i>
                    </button>
                    <button
                      onClick={() => setCorporateActionsPortfolio(portfolio)}
                      className="text-blue-500 hover:text-blue-700 p-1"
                      title={t("corporate.portfolio.scan")}
                    >
                      <i className="fas fa-calendar-check"></i>
                    </button>
                    <Link
                      href={`/portfolios/${portfolio.id}`}
                      className="text-blue-500 hover:text-blue-700 p-1"
                      title={t("portfolio.edit", "Edit")}
                    >
                      <i className="far fa-edit"></i>
                    </Link>
                    <button
                      onClick={() =>
                        deletePortfolio(
                          portfolio.id,
                          t("portfolio.delete", { code: portfolio.code }),
                        )
                      }
                      className="text-red-500 hover:text-red-700 p-1"
                      title={t("portfolio.delete.title", "Delete")}
                    >
                      <i className="far fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Mobile total - refined finance footer */}
          <div className="bg-gradient-to-r from-wealth-500 to-wealth-600 rounded-xl shadow-sm p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-white/90">
                {t("portfolios.total")}: {displayCurrency?.code}
              </span>
              <div className="text-right">
                <span className="text-xl font-bold text-white tabular-nums">
                  {displayCurrency?.symbol === "?"
                    ? displayCurrency?.code
                    : displayCurrency?.symbol}
                  <FormatValue value={totalMarketValue} />
                </span>
                {totalGainOnDay !== 0 && totalMarketValue && (
                  <QuickTooltip
                    text={`${totalGainOnDay >= 0 ? "+" : ""}${displayCurrency?.code || ""} ${totalGainOnDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  >
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        totalGainOnDay >= 0
                          ? "text-emerald-200"
                          : "text-red-200"
                      }`}
                    >
                      {(
                        (totalGainOnDay / (totalMarketValue - totalGainOnDay)) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  </QuickTooltip>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Table layout - Refined Finance styling */}
        <div className="hidden md:block px-4 py-4">
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-wealth-500 to-wealth-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAllSelection}
                      className="w-4 h-4 text-blue-500 rounded border-blue-300 bg-blue-400 focus:ring-white cursor-pointer"
                      title={t("portfolios.selectAll", "Select all")}
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-wealth-600/50 transition-colors"
                    onClick={() => handleSort("code")}
                  >
                    <div className="flex items-center">
                      {t("portfolio.code")}
                      {getSortIcon("code")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-wealth-600/50 transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      {t("portfolio.name")}
                      {getSortIcon("name")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-wealth-600/50 transition-colors"
                    onClick={() => handleSort("marketValue")}
                  >
                    <div className="flex items-center justify-end">
                      {t("portfolio.marketvalue")}
                      {getSortIcon("marketValue")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-wealth-600/50 transition-colors"
                    onClick={() => handleSort("gainOnDayPercent")}
                  >
                    <div className="flex items-center justify-end">
                      {t("portfolio.gainOnDayPercent", "Day %")}
                      {getSortIcon("gainOnDayPercent")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-wealth-600/50 transition-colors"
                    onClick={() => handleSort("irr")}
                  >
                    <div className="flex items-center justify-end">
                      {t("portfolio.irr")}
                      {getSortIcon("irr")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-wealth-600/50 transition-colors hidden xl:table-cell"
                    onClick={() => handleSort("valuedAt")}
                  >
                    <div className="flex items-center justify-center">
                      {t("portfolio.valuedAt", "Valued")}
                      {getSortIcon("valuedAt")}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold w-32">
                    {t("portfolio.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portfolios.map((portfolio, index) => (
                  <tr
                    key={portfolio.id}
                    className={`transition-colors duration-150 cursor-pointer ${
                      selectedPortfolios.has(portfolio.code)
                        ? "bg-wealth-50 hover:bg-wealth-100"
                        : index % 2 === 0
                          ? "bg-white hover:bg-sky-50"
                          : "bg-slate-50/40 hover:bg-sky-50"
                    }`}
                    onClick={(e) => {
                      if (
                        !(e.target as HTMLElement).closest(".action-buttons") &&
                        !(e.target as HTMLElement).closest(
                          ".selection-checkbox",
                        )
                      ) {
                        router.push(`/holdings/${portfolio.code}`)
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-center selection-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedPortfolios.has(portfolio.code)}
                        onChange={() =>
                          togglePortfolioSelection(portfolio.code)
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-wealth-600 font-semibold">
                        {portfolio.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {portfolio.name}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                      <FormatValue
                        value={
                          (portfolio.marketValue ? portfolio.marketValue : 0) *
                          (fxRates[portfolio.base.code] || 1)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {portfolio.gainOnDay !== undefined &&
                      portfolio.gainOnDay !== 0 &&
                      portfolio.marketValue ? (
                        <QuickTooltip
                          text={`${portfolio.gainOnDay >= 0 ? "+" : ""}${displayCurrency?.code || ""} ${(portfolio.gainOnDay * (fxRates[portfolio.base.code] || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        >
                          <span
                            className={`font-semibold tabular-nums ${
                              portfolio.gainOnDay >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {(
                              (portfolio.gainOnDay /
                                (portfolio.marketValue - portfolio.gainOnDay)) *
                              100
                            ).toFixed(2)}
                            %
                          </span>
                        </QuickTooltip>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          (portfolio.irr || 0) >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        <FormatValue
                          value={portfolio.irr}
                          multiplier={100}
                          isPublic
                        />
                        %
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden xl:table-cell">
                      <span
                        className={
                          isStale(portfolio.valuedAt)
                            ? "text-amber-500"
                            : "text-slate-600"
                        }
                        title={
                          portfolio.valuedAt
                            ? `Valued: ${portfolio.valuedAt}${portfolio.lastUpdated ? ` (Updated: ${formatLastUpdated(portfolio.lastUpdated)})` : ""}`
                            : "Not yet valued"
                        }
                      >
                        {formatValuedAt(portfolio.valuedAt)}
                        {isStale(portfolio.valuedAt) && (
                          <i className="fas fa-clock ml-1 text-xs"></i>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="action-buttons flex items-center justify-center space-x-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleShareClick(portfolio.id)
                          }}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title={t("shares.share")}
                        >
                          <i className="fas fa-share-alt text-lg"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setCorporateActionsPortfolio(portfolio)
                          }}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title={t("corporate.portfolio.scan")}
                        >
                          <i className="fas fa-calendar-check text-lg"></i>
                        </button>
                        <Link
                          href={`/portfolios/${portfolio.id}`}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title={t("portfolio.edit", "Edit Portfolio")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <i className="far fa-edit text-lg"></i>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePortfolio(
                              portfolio.id,
                              t("portfolio.delete", { code: portfolio.code }),
                            )
                          }}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title={t(
                            "portfolio.delete.title",
                            "Delete Portfolio",
                          )}
                        >
                          <i className="far fa-trash-alt text-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gradient-to-r from-wealth-500 to-wealth-600 text-white border-t-2 border-wealth-500">
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-sm font-semibold text-white/90"
                  >
                    {t("portfolios.total")}: {displayCurrency?.code}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-white tabular-nums">
                    {displayCurrency?.symbol === "?"
                      ? displayCurrency?.code
                      : displayCurrency?.symbol}
                    <FormatValue value={totalMarketValue} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {totalGainOnDay !== 0 && totalMarketValue ? (
                      <QuickTooltip
                        text={`${totalGainOnDay >= 0 ? "+" : ""}${displayCurrency?.code || ""} ${totalGainOnDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      >
                        <span
                          className={`font-bold tabular-nums ${
                            totalGainOnDay >= 0
                              ? "text-emerald-200"
                              : "text-red-200"
                          }`}
                        >
                          {(
                            (totalGainOnDay /
                              (totalMarketValue - totalGainOnDay)) *
                            100
                          ).toFixed(2)}
                          %
                        </span>
                      </QuickTooltip>
                    ) : (
                      <span className="text-wealth-200">-</span>
                    )}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (activeTab === "my" && (!data || !ready || (data.data.length > 0 && !fxRatesReady))) {
    return rootLoader(t("loading"))
  }

  return (
    <>
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex px-4">
          <button
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "my"
                ? "border-wealth-500 text-wealth-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("my")}
          >
            <i className="fas fa-briefcase mr-2"></i>
            {t("shares.tab.my")}
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "managed"
                ? "border-wealth-500 text-wealth-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("managed")}
          >
            <i className="fas fa-users mr-2"></i>
            {t("shares.tab.managed")}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "my" && data && listPortfolios(sortedPortfolios)}
      {activeTab === "managed" && <ManagedPortfolios />}

      {corporateActionsPortfolio && (
        <PortfolioCorporateActionsPopup
          portfolio={corporateActionsPortfolio}
          modalOpen={!!corporateActionsPortfolio}
          onClose={handleCorporateActionsClose}
        />
      )}
      {showImportDialog && (
        <PortfolioImportDialog
          onClose={handleImportClose}
          onComplete={handleImportComplete}
        />
      )}
      {sharePortfolioId !== null && data?.data && (
        <ShareInviteDialog
          portfolios={data.data}
          preSelectedPortfolioId={sharePortfolioId}
          onClose={() => setSharePortfolioId(null)}
          onSuccess={() => setSharePortfolioId(null)}
        />
      )}
    </>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common", "wealth"])),
  },
})
