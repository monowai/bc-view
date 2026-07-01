import React, { useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import Link from "next/link"
import useSwr from "swr"
import {
  portfoliosKey,
  simpleFetcher,
  ccyKey,
  holdingKey,
} from "@utils/api/fetchHelper"
import { Portfolio, Currency, HoldingContract } from "types/beancounter"
import { PlansResponse as IndependencePlansResponse } from "types/independence"
import {
  useAssetBreakdown,
  useFiProjectionSimple,
} from "@components/features/independence"
import ShareInviteDialog from "@components/features/portfolios/ShareInviteDialog"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import { useFxRates } from "@hooks/useFxRates"
import WealthHeroSection from "@components/features/wealth/WealthHeroSection"
import IndependenceMetrics from "@components/features/wealth/IndependenceMetrics"
import AssetAllocationCharts from "@components/features/wealth/AssetAllocationCharts"
import PortfolioDetailsTable from "@components/features/wealth/PortfolioDetailsTable"
import QuickActionCards from "@components/features/wealth/QuickActionCards"
import WealthPerformanceChart from "@components/features/wealth/WealthPerformanceChart"
import { useWealthSummary } from "@components/features/wealth/useWealthSummary"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"
import { deriveZenModeFromPreferences } from "@lib/user/zenMode"

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

function WealthDashboard(): React.ReactElement {
  const { preferences } = useUserPreferences()
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "value",
    direction: "desc",
  })

  const [showShareDialog, setShowShareDialog] = useState(false)

  // Collapsible sections state - all collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({
    performance: true,
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

  // Backend returns plans sorted: primary first, then by name
  const primaryPlan = plansData?.data?.[0]

  const currencies = useMemo(
    () => currencyData?.data || [],
    [currencyData?.data],
  )
  const portfolios: Portfolio[] = useMemo(
    () => portfolioData?.data || [],
    [portfolioData?.data],
  )
  const zenMode = deriveZenModeFromPreferences(portfolios.length, preferences)

  // Composite assets (CPF / pensions) have two cases:
  //   1. Parent trn lives in a portfolio (CompositeValuation already rolls
  //      sub-account balances into portfolio.marketValue) — adding them
  //      again here would double-count, which is exactly the bug Mary's
  //      account exposed (wealth 644k vs portfolio 363k).
  //   2. Standalone — config exists but no parent trn → portfolios miss
  //      the value, so we top it up via customAssetTotals.
  // CPF MA (Medisave) is statutory healthcare reserve, NOT spendable
  // wealth: it's always tracked separately under healthcareReserveTotals,
  // surfaced as its own tile, and netted out of Net Worth.
  const { configs: privateAssetConfigs } = usePrivateAssetConfigs()
  const portfolioAssetIds = useMemo(() => {
    const ids = new Set<string>()
    if (holdingsData?.positions) {
      Object.values(holdingsData.positions).forEach((position) => {
        const id = position.asset?.id
        if (id) ids.add(id)
      })
    }
    return ids
  }, [holdingsData])

  const { customAssetTotals, healthcareReserveTotals } = useMemo(() => {
    const customTotals: Record<string, number> = {}
    const reserveTotals: Record<string, number> = {}
    privateAssetConfigs.forEach((config) => {
      const subAccounts = config.subAccounts ?? []
      if (subAccounts.length === 0) return
      const currency = config.rentalCurrency || "USD"
      const parentInPortfolio = portfolioAssetIds.has(config.assetId)

      let nonReserve = 0
      let reserve = 0
      subAccounts.forEach((sa) => {
        const balance = sa.balance || 0
        if (balance === 0) return
        if (sa.code === "MA") {
          reserve += balance
        } else {
          nonReserve += balance
        }
      })

      if (reserve > 0) {
        reserveTotals[currency] = (reserveTotals[currency] || 0) + reserve
      }
      // Only add non-reserve sub-account balances when the parent
      // composite asset has NO trn in any portfolio — otherwise the
      // parent BALANCE trn already includes them via composite valuation.
      if (!parentInPortfolio && nonReserve > 0) {
        customTotals[currency] = (customTotals[currency] || 0) + nonReserve
      }
    })
    return {
      customAssetTotals: customTotals,
      healthcareReserveTotals: reserveTotals,
    }
  }, [privateAssetConfigs, portfolioAssetIds])

  // FX rates for converting portfolio values to display currency
  const sourceCurrencyCodes = useMemo(
    () => [
      ...portfolios.map((p) => p.base.code),
      ...portfolios.map((p) => p.currency.code),
      ...Object.keys(customAssetTotals),
      ...Object.keys(healthcareReserveTotals),
    ],
    [portfolios, customAssetTotals, healthcareReserveTotals],
  )
  const { displayCurrency, setDisplayCurrency, fxRates, fxReady } = useFxRates(
    currencies,
    sourceCurrencyCodes,
  )

  // Fetch investment over the rolling 30-day window (depends on display currency)
  const monthlyInvestmentUrl = displayCurrency
    ? `/api/trns/investments/monthly?currency=${displayCurrency.code}&days=30`
    : null
  const { data: monthlyInvestmentData } = useSwr<{
    startDate: string
    endDate: string
    totalInvested: number
    currency?: string
  }>(
    monthlyInvestmentUrl,
    monthlyInvestmentUrl ? simpleFetcher(monthlyInvestmentUrl) : null,
  )

  // Handle sorting
  const handleSort = (key: string): void => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: key === "code" ? "asc" : "desc" }
    })
  }

  // Calculate wealth summary
  const summary = useWealthSummary(
    portfolios,
    fxRates,
    sortConfig,
    holdingsData,
    customAssetTotals,
    healthcareReserveTotals,
  )

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

  if (portfolioError) {
    return errorOut("Error retrieving portfolios", portfolioError)
  }

  // Wait for aggregated holdings too: customAssetTotals' double-count guard
  // keys off portfolioAssetIds (derived from holdings). Rendering before
  // holdings arrive counts a composite (e.g. CPF) that the portfolio already
  // includes, so the headline value flickers high then corrects down once
  // holdings load. Gating here renders the final value once.
  if (portfolioLoading || !fxReady || holdingsLoading) {
    return rootLoader("Loading...")
  }

  if (portfolios.length === 0 && Object.keys(customAssetTotals).length === 0) {
    return (
      <>
        <Head>
          <title>Net Worth | Holdsworth</title>
        </Head>
        <div className="min-h-screen bg-gray-50 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero banner */}
            <div className="bg-blue-600 rounded-2xl p-8 text-center text-white shadow-lg mb-8">
              <h1 className="text-3xl font-bold mb-2">Net Worth</h1>
              <p className="text-white/80">
                {
                  "Add a portfolio to see your net worth across brokers, assets, and currencies"
                }
              </p>
            </div>

            {/* Setup prompt cards */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
                  {"Let's Get You Started"}
                </h2>
                <p className="text-gray-600 mb-6 text-center">
                  {"No portfolios yet"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link
                    href="/onboarding"
                    className="border border-gray-200 rounded-xl p-5 text-center hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="fas fa-rocket text-xl text-blue-500"></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {"Start Setup"}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {"Guided setup for bank accounts, property, and pensions"}
                    </p>
                  </Link>
                  <Link
                    href="/portfolios/__NEW__"
                    className="border border-gray-200 rounded-xl p-5 text-center hover:border-green-300 hover:shadow-md transition-all"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="fas fa-plus text-xl text-green-500"></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {"Add"}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {"Create a portfolio directly with full control"}
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Net Worth | Holdsworth</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero — Net Worth */}
          <WealthHeroSection
            summary={summary}
            displayCurrency={displayCurrency}
            currencies={currencies}
            portfolios={portfolios}
            onCurrencyChange={setDisplayCurrency}
            onShareClick={() => setShowShareDialog(true)}
          />

          {/* Asset Allocation — surfaced above Independence metrics */}
          <AssetAllocationCharts
            summary={summary}
            holdings={holdingsData}
            fxRates={fxRates}
            displayCurrency={displayCurrency}
            collapsed={collapsedSections.charts}
            onToggle={() => toggleSection("charts")}
          />

          {/* Independence Metrics - shown if user has an independence plan */}
          {primaryPlan && (
            <IndependenceMetrics
              primaryPlan={primaryPlan}
              projectionData={projectionData}
              projectionLoading={projectionLoading}
              monthlyInvestmentData={monthlyInvestmentData}
              displayCurrency={displayCurrency}
              collapsed={collapsedSections.independence}
              onToggle={() => toggleSection("independence")}
            />
          )}

          {/* Wealth Performance */}
          {preferences?.enableTwr && (
            <WealthPerformanceChart
              portfolios={portfolios}
              displayCurrency={displayCurrency}
              collapsed={collapsedSections.performance}
              onToggle={() => toggleSection("performance")}
            />
          )}

          {/* Portfolio Details Table — hidden in zen mode (a single
              portfolio is a one-row table with nothing to compare). */}
          {!zenMode && (
            <PortfolioDetailsTable
              summary={summary}
              sortConfig={sortConfig}
              onSort={handleSort}
              displayCurrency={displayCurrency}
              collapsed={collapsedSections.portfolioDetails}
              onToggle={() => toggleSection("portfolioDetails")}
            />
          )}

          {/* Quick Actions */}
          <QuickActionCards zenMode={zenMode} />
        </div>
      </div>

      {showShareDialog && (
        <ShareInviteDialog
          portfolios={portfolios}
          onClose={() => setShowShareDialog(false)}
          onSuccess={() => setShowShareDialog(false)}
        />
      )}
    </>
  )
}

export default withPageAuthRequired(WealthDashboard)
