import React, { useMemo, useState } from "react"
import { Portfolio } from "types/beancounter"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import { useNetWorthData } from "@components/features/wealth/useNetWorthData"
import { useWealthSummary } from "@components/features/wealth/useWealthSummary"
import WealthHeroSection from "@components/features/wealth/WealthHeroSection"
import AssetAllocationCharts from "@components/features/wealth/AssetAllocationCharts"
import PortfolioDetailsTable from "@components/features/wealth/PortfolioDetailsTable"
import Spinner from "@components/ui/Spinner"

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

/** Manual asset categories matching the wizard's AssetsStep. */
const MANUAL_ASSET_CATEGORIES: { key: string; label: string }[] = [
  { key: "CASH", label: "Cash & Bank Accounts" },
  { key: "EQUITY", label: "Stocks & Shares" },
  { key: "ETF", label: "ETFs" },
  { key: "MUTUAL_FUND", label: "Mutual Funds" },
  { key: "RE", label: "Real Estate" },
]

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function parseJsonStringRecord(
  raw: string | null | undefined,
): Record<string, number> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {}
  } catch {
    return {}
  }
}

/**
 * NetWorthTab — account-level Net Worth breakdown within the Composite view.
 *
 * Shows the user's wealth from their portfolios (liquid / non-spendable /
 * CPF / housing) and lets them configure — once, account-wide — which
 * portfolios count toward FI calculations. The excludedPortfolioIds and
 * manualAssets settings are persisted to UserIndependenceSettings and
 * re-derived by svc-retire for every phase's gauge.
 *
 * Note on holdingsData filtering: the aggregated holdings endpoint aggregates
 * positions by asset across all portfolios — per-portfolio filtering of
 * holdingsData positions is not feasible. The portfolios array IS filtered
 * (accurate headline total), while holdingsData is passed as-is (the
 * classification chart will include excluded portfolios' positions, which is
 * an acceptable approximation for this view).
 */
export default function NetWorthTab(): React.ReactElement {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "value",
    direction: "desc",
  })
  const [collapsedSections, setCollapsedSections] = useState({
    charts: false,
    portfolioDetails: false,
  })

  const { settings, updateSettings, mutateSettings } = useIndependenceSettings()

  const {
    portfolios,
    holdingsData,
    currencies,
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    customAssetTotals,
    healthcareReserveTotals,
    isLoading,
  } = useNetWorthData()

  // Parse account-wide exclusion list from JSON string field
  const excludedIds: string[] = useMemo(
    () => parseJsonStringArray(settings?.excludedPortfolioIds),
    [settings?.excludedPortfolioIds],
  )
  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds])

  // Filter portfolios to include only non-excluded ones for the summary
  const includedPortfolios: Portfolio[] = useMemo(
    () => portfolios.filter((p) => !excludedSet.has(p.id)),
    [portfolios, excludedSet],
  )

  const summary = useWealthSummary(
    includedPortfolios,
    fxRates,
    sortConfig,
    holdingsData,
    customAssetTotals,
    healthcareReserveTotals,
  )

  // Gates the manual assets editor — only shown when no balances exist
  const portfoliosWithBalance: Portfolio[] = useMemo(
    () => portfolios.filter((p) => (p.marketValue ?? 0) !== 0),
    [portfolios],
  )

  // Parse manual asset estimates from JSON string field
  const manualAssetsRecord: Record<string, number> = useMemo(
    () => parseJsonStringRecord(settings?.manualAssets),
    [settings?.manualAssets],
  )

  const handleSort = (key: string): void => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: key === "code" ? "asc" : "desc" }
    })
  }

  const toggleExclusion = (portfolioId: string): void => {
    const next = excludedSet.has(portfolioId)
      ? excludedIds.filter((id) => id !== portfolioId)
      : [...excludedIds, portfolioId]
    updateSettings({ excludedPortfolioIds: JSON.stringify(next) })
      .then(() => mutateSettings())
      .catch(console.error)
  }

  const handleManualAssetChange = (key: string, value: number): void => {
    const next = { ...manualAssetsRecord, [key]: value }
    updateSettings({ manualAssets: JSON.stringify(next) })
      .then(() => mutateSettings())
      .catch(console.error)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Loading wealth data..." size="lg" />
      </div>
    )
  }

  return (
    <div>
      {/* Account-wide scope notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <i className="fas fa-wallet text-blue-500 mt-0.5 shrink-0"></i>
        <div>
          <p className="text-sm font-medium text-blue-800">
            Account-wide Net Worth
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            This view reflects your actual portfolio wealth and drives the FI
            gauge across every phase. Use the settings below to control which
            portfolios are included.
          </p>
        </div>
      </div>

      {/* Headline wealth summary */}
      <WealthHeroSection
        summary={summary}
        displayCurrency={displayCurrency}
        currencies={currencies}
        portfolios={includedPortfolios}
        onCurrencyChange={setDisplayCurrency}
        onShareClick={() => {}}
      />

      {/* Classification breakdown */}
      <AssetAllocationCharts
        summary={summary}
        holdings={holdingsData}
        fxRates={fxRates}
        displayCurrency={displayCurrency}
        collapsed={collapsedSections.charts}
        onToggle={() =>
          setCollapsedSections((prev) => ({
            ...prev,
            charts: !prev.charts,
          }))
        }
      />

      {/* Per-portfolio breakdown */}
      {includedPortfolios.length > 1 && (
        <PortfolioDetailsTable
          summary={summary}
          sortConfig={sortConfig}
          onSort={handleSort}
          displayCurrency={displayCurrency}
          collapsed={collapsedSections.portfolioDetails}
          onToggle={() =>
            setCollapsedSections((prev) => ({
              ...prev,
              portfolioDetails: !prev.portfolioDetails,
            }))
          }
        />
      )}

      {/* Portfolio inclusion editor */}
      {portfolios.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">
              Which portfolios count toward your wealth
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Account-wide — affects the FI gauge across all phases.
            </p>
          </div>
          <div className="px-6 py-4 space-y-2">
            {portfolios.map((portfolio) => (
              <label
                key={portfolio.id}
                className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!excludedSet.has(portfolio.id)}
                  onChange={() => toggleExclusion(portfolio.id)}
                  className="h-4 w-4 text-independence-600 focus:ring-independence-500 border-gray-300 rounded"
                />
                <div className="ml-3 flex-1">
                  <span className="font-medium text-gray-900">
                    {portfolio.code}
                  </span>
                  <span className="text-gray-500 ml-2">{portfolio.name}</span>
                </div>
                <span className="text-gray-700 font-medium text-sm">
                  {portfolio.base?.code}{" "}
                  {Math.round(portfolio.marketValue || 0).toLocaleString()}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Manual asset estimates — only when no portfolio balances exist */}
      {portfoliosWithBalance.length === 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">
              Estimated Assets
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              No portfolio balances found. Enter estimated values to drive the
              FI gauge while you set up your portfolios.
            </p>
          </div>
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {MANUAL_ASSET_CATEGORIES.map((cat) => (
              <div key={cat.key}>
                <label
                  htmlFor={`manual-asset-${cat.key}`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {cat.label}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 pointer-events-none">
                    $
                  </span>
                  <input
                    id={`manual-asset-${cat.key}`}
                    type="number"
                    min={0}
                    step={1000}
                    value={manualAssetsRecord[cat.key] || 0}
                    onChange={(e) =>
                      handleManualAssetChange(
                        cat.key,
                        Number(e.target.value) || 0,
                      )
                    }
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
