import React, { useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
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
import { useWealthSummary } from "@components/features/wealth/useWealthSummary"

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

function WealthDashboard(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "value",
    direction: "desc",
  })

  const [showShareDialog, setShowShareDialog] = useState(false)

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

  // FX rates for converting portfolio values to display currency
  const sourceCurrencyCodes = useMemo(
    () => portfolios.map((p) => p.base.code),
    [portfolios],
  )
  const { displayCurrency, setDisplayCurrency, fxRates, fxReady } = useFxRates(
    currencies,
    sourceCurrencyCodes,
  )

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
  const summary = useWealthSummary(portfolios, fxRates, sortConfig, holdingsData)

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
    return errorOut(t("portfolios.error.retrieve"), portfolioError)
  }

  if (portfolioLoading || !ready || !fxReady) {
    return rootLoader(t("loading"))
  }

  if (portfolios.length === 0) {
    return (
      <>
        <Head>
          <title>Net Worth | Holdsworth</title>
        </Head>
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero banner */}
            <div className="bg-linear-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-center text-white shadow-lg mb-8">
              <h1 className="text-3xl font-bold mb-2">Net Worth</h1>
              <p className="text-blue-100">
                {t(
                  "wealth.empty.subtitle",
                  "Add a portfolio to see your net worth across brokers, assets, and currencies",
                )}
              </p>
            </div>

            {/* Setup prompt cards */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
                  {t("home.getStarted", "Let's Get You Started")}
                </h2>
                <p className="text-gray-600 mb-6 text-center">
                  {t("portfolios.empty.title", "No portfolios yet")}
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
                      {t("home.startSetup", "Start Setup")}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {t(
                        "portfolios.guided",
                        "Guided setup for bank accounts, property, and pensions",
                      )}
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

      <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 py-6">
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

          {/* Charts Row */}
          <AssetAllocationCharts
            summary={summary}
            displayCurrency={displayCurrency}
            collapsed={collapsedSections.charts}
            onToggle={() => toggleSection("charts")}
          />

          {/* Portfolio Details Table */}
          <PortfolioDetailsTable
            summary={summary}
            sortConfig={sortConfig}
            onSort={handleSort}
            displayCurrency={displayCurrency}
            collapsed={collapsedSections.portfolioDetails}
            onToggle={() => toggleSection("portfolioDetails")}
          />

          {/* Quick Actions */}
          <QuickActionCards />
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

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
