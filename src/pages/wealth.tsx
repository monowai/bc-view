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
import { useIndependencePlans } from "@hooks/useIndependencePlans"
import {
  journeyPhasePlans,
  landingPlan,
  primaryJourney,
} from "@lib/independence/journeyPhases"
import WealthHeroSection from "@components/features/wealth/WealthHeroSection"
import IndependenceMetrics from "@components/features/wealth/IndependenceMetrics"
import AssetAllocationCharts from "@components/features/wealth/AssetAllocationCharts"
import PortfolioDetailsTable from "@components/features/wealth/PortfolioDetailsTable"
import QuickActionCards from "@components/features/wealth/QuickActionCards"
import WealthPerformanceChart from "@components/features/wealth/WealthPerformanceChart"
import { useNetWorth } from "@components/features/wealth/useNetWorth"
import {
  EMPTY_WEALTH_SUMMARY,
  toWealthSummary,
} from "@lib/wealth/wealthSummary"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
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

  // Fetch phase plans (every journey's, flat) and the journeys themselves
  const { data: plansData } = useSwr<IndependencePlansResponse>(
    "/api/independence/plans",
    simpleFetcher("/api/independence/plans"),
  )
  const { plans: journeys, isLoading: journeysLoading } = useIndependencePlans()

  const phasePlans = useMemo(() => plansData?.data ?? [], [plansData?.data])

  // The phase plan whose numbers drive the independence headline.
  // `/plans` returns phase plans across *every* plan the user owns, so an
  // index into that list picks whichever journey happens to sort first —
  // "life renting" reported under a dashboard the user reads as "life owning
  // the house". Resolve through the primary journey and take a phase of its
  // own. With no journey at all (legacy account, or the list still loading)
  // degrade to the plan the user flagged primary, and to nothing rather than
  // an arbitrary row — the section below is hidden when nothing resolves.
  const primaryPlan = useMemo(() => {
    const ownPhases = journeyPhasePlans(primaryJourney(journeys), phasePlans)
    return landingPlan(ownPhases) ?? phasePlans.find((plan) => plan.isPrimary)
  }, [journeys, phasePlans])

  const currencies = useMemo(
    () => currencyData?.data || [],
    [currencyData?.data],
  )
  const portfolios: Portfolio[] = useMemo(
    () => portfolioData?.data || [],
    [portfolioData?.data],
  )
  const zenMode = deriveZenModeFromPreferences(portfolios.length, preferences)

  // FX rates for the allocation chart slices (the headline arrives already
  // converted by svc-position)
  const sourceCurrencyCodes = useMemo(
    () => [
      ...portfolios.map((p) => p.base.code),
      ...portfolios.map((p) => p.currency.code),
    ],
    [portfolios],
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

  // The headline is svc-position's, in the display currency. Standalone
  // composites (a config-only CPF) and the healthcare reserve are already
  // folded in there; nothing is re-derived from holdings here.
  const {
    netWorth,
    isLoading: netWorthLoading,
    error: netWorthError,
  } = useNetWorth(displayCurrency)
  const summary = useMemo(
    () =>
      netWorth ? toWealthSummary(netWorth, sortConfig) : EMPTY_WEALTH_SUMMARY,
    [netWorth, sortConfig],
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
  if (netWorthError) {
    return errorOut("Error retrieving net worth", netWorthError)
  }

  // Render the headline once, when the server has it — never a client-side
  // approximation that corrects itself a beat later. Holdings stay in the
  // gate so the allocation charts never read an in-flight pot as empty.
  if (portfolioLoading || holdingsLoading || !fxReady || netWorthLoading) {
    return rootLoader("Loading...")
  }

  // A config-only composite (e.g. a CPF with no portfolio trn) still counts
  // as wealth, so the empty state keys off the server total, not the list.
  if (portfolios.length === 0 && summary.totalValue === 0) {
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  {/* Independence belongs on the "getting started" card:
                      it is the reason for the portfolios, and the nav menu
                      was the only way in. */}
                  <Link
                    href="/independence"
                    className="border border-gray-200 rounded-xl p-5 text-center hover:border-independence-200 hover:shadow-md transition-all"
                  >
                    <div className="w-12 h-12 bg-independence-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="fas fa-compass text-xl text-independence-500"></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {"Plan your independence"}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {"Map out when work becomes optional."}
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

          {/* ...and a door to build one when there is none. The slot used to
              collapse to nothing, which reads as "independence isn't part of
              this product". Only once we know there is no plan — while the
              journeys or their phases are still loading, "none" is not yet
              true and the CTA would flash under a plan that does exist. */}
          {!primaryPlan && !journeysLoading && plansData !== undefined && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 text-center">
              <div className="w-12 h-12 bg-independence-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-compass text-xl text-independence-500"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {"No independence plan yet"}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {
                  "Map out your stages and we'll show when work becomes optional."
                }
              </p>
              <Link
                href="/independence"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-independence-600 text-white text-sm font-medium hover:bg-independence-700 transition-colors"
              >
                {"Plan your independence"}
              </Link>
            </div>
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
