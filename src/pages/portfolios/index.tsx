import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import useSwr from "swr"
import { UserProfile, withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { Portfolio, Currency, FxResponse } from "types/beancounter"
import Link from "next/link"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import { FormatValue } from "@components/ui/MoneyUtils"
import PortfolioCorporateActionsPopup from "@components/features/portfolios/PortfolioCorporateActionsPopup"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

interface PortfolioActionsProps {
  onImportClick: () => void
}

const PortfolioActions = ({
  onImportClick,
}: PortfolioActionsProps): React.ReactElement => {
  const router = useRouter()
  const { t } = useTranslation("common")
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const response = await fetch("/api/portfolios/export")
      if (!response.ok) {
        console.error("Export failed: HTTP", response.status)
        return
      }
      const csvContent = await response.text()
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "portfolios.csv"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Import/Export hidden on mobile */}
      <button
        className="hidden md:flex bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors items-center"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <i className="fas fa-spinner fa-spin mr-2"></i>
        ) : (
          <i className="fas fa-download mr-2"></i>
        )}
        {t("portfolios.export")}
      </button>
      <button
        className="hidden md:flex bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors items-center"
        onClick={onImportClick}
      >
        <i className="fas fa-upload mr-2"></i>
        {t("portfolios.import")}
      </button>
      <button
        className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center shadow-sm"
        onClick={() => router.push(`/portfolios/__NEW__`)}
      >
        <i className="fas fa-plus mr-2"></i>
        <span className="hidden sm:inline">{t("portfolio.create")}</span>
        <span className="sm:hidden">{t("new")}</span>
      </button>
    </div>
  )
}

const CreatePortfolioButton = (): React.ReactElement => {
  const router = useRouter()
  const { t } = useTranslation("common")

  return (
    <button
      className="bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors shadow-sm flex items-center"
      onClick={() => router.push(`/portfolios/__NEW__`)}
    >
      <i className="fas fa-plus mr-2"></i>
      {t("portfolio.create")}
    </button>
  )
}

export default withPageAuthRequired(function Portfolios({
  user,
}: UserProfile): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const router = useRouter()
  const { preferences } = useUserPreferences()
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

  // Currency display state
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [displayCurrency, setDisplayCurrency] = useState<Currency | null>(null)
  const [fxRates, setFxRates] = useState<Record<string, number>>({})

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

  // Set default display currency from user's preferred base currency
  useEffect(() => {
    if (currencies.length === 0 || displayCurrency) return

    // Use user's preferred base currency if available
    if (preferences?.baseCurrencyCode) {
      const preferredCurrency = currencies.find(
        (c) => c.code === preferences.baseCurrencyCode,
      )
      if (preferredCurrency) {
        setDisplayCurrency(preferredCurrency)
        return
      }
    }

    // Fall back to USD or first currency
    const usd = currencies.find((c) => c.code === "USD")
    setDisplayCurrency(usd || currencies[0])
  }, [currencies, displayCurrency, preferences?.baseCurrencyCode])

  // Fetch FX rates for portfolio base currencies
  // Note: portfolio.marketValue is stored in the portfolio's BASE currency
  useEffect(() => {
    const portfolioList = data?.data
    if (!displayCurrency || !portfolioList || portfolioList.length === 0) return

    const uniqueCurrencies: string[] = [
      ...new Set<string>(portfolioList.map((p: Portfolio) => p.base.code)),
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
  }, [displayCurrency, data?.data])

  const handleCorporateActionsClose = useCallback(() => {
    setCorporateActionsPortfolio(null)
  }, [])

  const handleImportClick = useCallback(() => {
    setShowImportDialog(true)
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

  // Sort icon component
  const getSortIcon = (headerKey: string): React.ReactElement => {
    if (!sortConfig || sortConfig.key !== headerKey) {
      return <span className="ml-1 text-gray-400">↕</span>
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-blue-300">↑</span>
    ) : (
      <span className="ml-1 text-blue-300">↓</span>
    )
  }

  function listPortfolios(portfolios: Portfolio[]): React.ReactElement {
    if (!portfolios || portfolios.length == 0) {
      return (
        <div className="min-h-screen bg-gray-50 px-4 py-8">
          <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-folder-open text-2xl text-gray-400"></i>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t("portfolios.empty.title", "No portfolios yet")}
            </h2>
            <p className="text-gray-600 mb-6">{t("error.portfolios.empty")}</p>
            <CreatePortfolioButton />
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
              <PortfolioActions onImportClick={handleImportClick} />
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
                  ? "border-blue-300 bg-blue-50"
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
                      <div className="font-semibold text-blue-600">
                        {portfolio.code}
                      </div>
                      <div className="text-gray-900">{portfolio.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {displayCurrency?.symbol}
                      <FormatValue
                        value={
                          (portfolio.marketValue ? portfolio.marketValue : 0) *
                          (fxRates[portfolio.base.code] || 1)
                        }
                      />
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        (portfolio.irr || 0) >= 0
                          ? "text-green-600"
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
                  <span>
                    {portfolio.currency.symbol}
                    {portfolio.currency.code}
                  </span>
                  <div
                    className="flex items-center space-x-4"
                    onClick={(e) => e.stopPropagation()}
                  >
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

          {/* Mobile total */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">
                {t("portfolios.total")}
              </span>
              <span className="text-xl font-bold text-gray-900">
                {displayCurrency?.symbol}
                <FormatValue value={totalMarketValue} />
              </span>
            </div>
          </div>
        </div>

        {/* Desktop: Table layout */}
        <div className="hidden md:block px-4 py-4">
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAllSelection}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      title={t("portfolios.selectAll", "Select all")}
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort("code")}
                  >
                    <div className="flex items-center">
                      {t("portfolio.code")}
                      {getSortIcon("code")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      {t("portfolio.name")}
                      {getSortIcon("name")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort("currency")}
                  >
                    <div className="flex items-center">
                      {t("portfolio.currency.report")}
                      {getSortIcon("currency")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors hidden lg:table-cell"
                    onClick={() => handleSort("base")}
                  >
                    <div className="flex items-center">
                      {t("portfolio.currency.base")}
                      {getSortIcon("base")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort("marketValue")}
                  >
                    <div className="flex items-center justify-end">
                      {t("portfolio.marketvalue")}
                      {getSortIcon("marketValue")}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort("irr")}
                  >
                    <div className="flex items-center justify-end">
                      {t("portfolio.irr")}
                      {getSortIcon("irr")}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                    {t("portfolio.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {portfolios.map((portfolio) => (
                  <tr
                    key={portfolio.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      selectedPortfolios.has(portfolio.code) ? "bg-blue-50" : ""
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
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-blue-600 font-semibold">
                        {portfolio.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {portfolio.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {portfolio.currency.symbol} {portfolio.currency.code}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {portfolio.base.symbol} {portfolio.base.code}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      <FormatValue
                        value={
                          (portfolio.marketValue ? portfolio.marketValue : 0) *
                          (fxRates[portfolio.base.code] || 1)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          (portfolio.irr || 0) >= 0
                            ? "text-green-600"
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
                    <td className="px-4 py-3">
                      <div className="action-buttons flex items-center justify-center space-x-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setCorporateActionsPortfolio(portfolio)
                          }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title={t("corporate.portfolio.scan")}
                        >
                          <i className="fas fa-calendar-check text-lg"></i>
                        </button>
                        <Link
                          href={`/portfolios/${portfolio.id}`}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
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
                          className="text-gray-400 hover:text-red-600 transition-colors"
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
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-right font-bold text-gray-700"
                  >
                    {t("portfolios.total")}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 text-lg">
                    {displayCurrency?.symbol}
                    <FormatValue value={totalMarketValue} />
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (!data || !ready) {
    return rootLoader(t("loading"))
  }
  // Use the user variable somewhere in your component
  return (
    <>
      {listPortfolios(sortedPortfolios)}
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
    </>
  )
})

interface PortfolioImportDialogProps {
  onClose: () => void
  onComplete: () => Promise<void>
}

const PortfolioImportDialog: React.FC<PortfolioImportDialogProps> = ({
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation("common")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ count: number } | null>(
    null,
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      setImportResult(null)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!selectedFile) {
      setError("Please select a file")
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      const csvContent = await selectedFile.text()
      const response = await fetch("/api/portfolios/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Import failed")
        return
      }

      const result = await response.json()
      const count = result.data ? result.data.length : 0
      setImportResult({ count })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const handleDone = async (): Promise<void> => {
    await onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl font-semibold">
            {t("portfolios.import.title")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="space-y-4">
          {!importResult ? (
            <>
              <p className="text-sm text-gray-600">
                {t("portfolios.import.hint")}
              </p>

              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <i className="fas fa-file-csv text-4xl text-gray-400 mb-2"></i>
                {selectedFile ? (
                  <p className="text-sm text-gray-700 font-medium">
                    {selectedFile.name}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    {t("portfolios.import.select")}
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <i className="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
              <p className="text-green-700 font-medium">
                {t("portfolios.import.success", { count: importResult.count })}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          {!importResult ? (
            <>
              <button
                type="button"
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
                onClick={onClose}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded transition-colors text-white ${
                  isImporting || !selectedFile
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
                onClick={handleImport}
                disabled={isImporting || !selectedFile}
              >
                {isImporting ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("portfolios.importing")}
                  </span>
                ) : (
                  t("portfolios.import")
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              onClick={handleDone}
            >
              {t("done")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
