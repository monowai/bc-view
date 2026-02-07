import React, { useMemo, useState } from "react"
import {
  TableSkeletonLoader,
  SummarySkeletonLoader,
} from "@components/ui/SkeletonLoader"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { errorOut } from "@components/errors/ErrorOut"
import { useHoldingState } from "@lib/holdings/holdingState"
import { useHoldingsView } from "@lib/holdings/useHoldingsView"
import HoldingsHeader from "@components/features/holdings/HoldingsHeader"
import HoldingMenu from "@components/features/holdings/HoldingMenu"
import Rows from "@components/features/holdings/Rows"
import SubTotal from "@components/features/holdings/SubTotal"
import Header from "@components/features/holdings/Header"
import GrandTotal from "@components/features/holdings/GrandTotal"
import PerformanceHeatmap from "@components/ui/PerformanceHeatmap"
import SummaryView from "@components/features/holdings/SummaryView"
import CardView from "@components/features/holdings/CardView"
import AllocationChart from "@components/features/allocation/AllocationChart"
import { compareByReportCategory, compareBySector } from "@lib/categoryMapping"
import {
  GroupBy,
  useGroupOptions,
} from "@components/features/holdings/GroupByOptions"
import CopyPopup from "@components/ui/CopyPopup"
import IncomeView from "@components/features/holdings/IncomeView"
import { ViewMode } from "@components/features/holdings/ViewToggle"

/** View mode icon component */
const ViewModeIcon: React.FC<{ mode: string; className?: string }> = ({
  mode,
  className = "w-3.5 h-3.5",
}) => {
  switch (mode) {
    case "summary":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      )
    case "cards":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
      )
    case "heatmap":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
      )
    case "income":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    case "table":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h18M3 10h18M3 16h18"
          />
        </svg>
      )
    default:
      return null
  }
}

/** GroupBy icon component */
const GroupByIcon: React.FC<{ groupBy: string; className?: string }> = ({
  groupBy,
  className = "w-3.5 h-3.5",
}) => {
  switch (groupBy) {
    case GroupBy.ASSET_CLASS:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      )
    case GroupBy.SECTOR:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
          />
        </svg>
      )
    case GroupBy.MARKET_CURRENCY:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    case GroupBy.MARKET:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    default:
      return null
  }
}

const viewModes: { value: ViewMode; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "cards", label: "Cards" },
  { value: "heatmap", label: "Heatmap" },
  { value: "income", label: "Income" },
  { value: "table", label: "Table" },
]

function AggregatedHoldingsPage(): React.ReactElement {
  const router = useRouter()
  const { t, ready } = useTranslation("common")
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()
  // Get portfolio codes from URL query parameter
  const codes = router.query.codes as string | undefined
  const portfolioCodes = useMemo(() => (codes ? codes.split(",") : []), [codes])

  // Build the API URL with optional codes parameter
  const aggregatedHoldingsKey = codes
    ? `/api/holdings/aggregated?asAt=today&codes=${encodeURIComponent(codes)}`
    : "/api/holdings/aggregated?asAt=today"

  const { data, error, isLoading } = useSwr(
    aggregatedHoldingsKey,
    simpleFetcher(aggregatedHoldingsKey),
  )

  // Use shared hook for view state and calculations
  const {
    viewMode,
    setViewMode,
    sortConfig,
    allocationGroupBy,
    excludedCategories,
    handleSort,
    handleToggleCategory,
    holdings,
    allocationData,
    allocationTotalValue,
  } = useHoldingsView(data?.data)

  // State for copy functionality
  const [columns, setColumns] = useState<string[]>([])
  const [copyModalOpen, setCopyModalOpen] = useState(false)

  // Determine the subtitle based on selected portfolios
  const subtitle = useMemo(() => {
    if (portfolioCodes.length === 0) {
      return t(
        "holdings.aggregated.all",
        "Showing holdings across all portfolios",
      )
    }
    if (portfolioCodes.length === 1) {
      return t("holdings.aggregated.single", "Showing holdings for {{code}}", {
        code: portfolioCodes[0],
      })
    }
    return t(
      "holdings.aggregated.selected",
      "Showing holdings for {{count}} portfolios",
      {
        count: portfolioCodes.length,
      },
    )
  }, [portfolioCodes, t])

  if (error && ready) {
    return errorOut(
      t("holdings.error.aggregated", "Failed to load aggregated holdings"),
      error,
    )
  }

  if (isLoading || !ready) {
    return (
      <div className="space-y-4">
        <SummarySkeletonLoader />
        <TableSkeletonLoader rows={10} />
      </div>
    )
  }

  if (!data?.data || !holdings) {
    return (
      <div className="w-full py-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-gray-600">
            {t("holdings.aggregated.empty", "No holdings found")}
          </div>
        </div>
      </div>
    )
  }

  const holdingResults = data.data

  return (
    <>
      <HoldingMenu
        portfolio={holdingResults.portfolio}
        showPortfolioSelector={false}
      />
      <div className="w-full py-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("holdings.aggregated.title", "Aggregated Holdings")}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </div>
        {/* Toolbar row - view mode and groupby controls visible on all devices */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 mb-2 gap-2">
          {/* View mode and GroupBy controls */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 overflow-x-auto shrink-0">
            {/* View Mode buttons */}
            {viewModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === mode.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                aria-label={`${mode.label} view`}
                title={mode.label}
              >
                <ViewModeIcon mode={mode.value} />
                <span className="hidden lg:inline text-xs">{mode.label}</span>
              </button>
            ))}

            {/* Separator */}
            <div className="w-px h-5 bg-gray-300 mx-1 shrink-0" />

            {/* GroupBy buttons */}
            {groupOptions.values.map((option) => (
              <button
                key={option.value}
                onClick={() => holdingState.setGroupBy(option)}
                className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  holdingState.groupBy.value === option.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                aria-label={option.label}
                title={option.label}
              >
                <GroupByIcon groupBy={option.value} />
                <span className="hidden xl:inline text-xs">{option.label}</span>
              </button>
            ))}
          </div>

          {/* Action buttons - hidden on mobile portrait */}
          <div className="mobile-portrait:hidden flex items-center space-x-2 shrink-0">
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
              onClick={() => setCopyModalOpen(true)}
            >
              <i className="fas fa-copy mr-2"></i>
              <span className="hidden sm:inline">Copy Data</span>
              <span className="sm:hidden">Copy</span>
            </button>
            <button
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
              onClick={() => {
                const portfolioParams = codes
                  ? `?portfolios=${encodeURIComponent(codes)}`
                  : ""
                router.push(`/rebalance/wizard${portfolioParams}`)
              }}
            >
              <i className="fas fa-balance-scale mr-2"></i>
              <span className="hidden sm:inline">Rebalance</span>
            </button>
          </div>
        </div>

        {viewMode === "summary" ? (
          <div className="grid grid-cols-1 gap-3">
            <SummaryView
              holdings={holdings}
              allocationData={allocationData}
              groupBy={allocationGroupBy}
            />
          </div>
        ) : viewMode === "table" ? (
          <div className="flex flex-col">
            {/* Fixed header area */}
            <div className="shrink-0">
              <HoldingsHeader
                portfolio={holdingResults.portfolio}
                holdings={holdings}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                isAggregated={true}
              />
            </div>
            {/* Scrollable table container */}
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              <table className="min-w-full bg-white">
                {(() => {
                  let cumulativeCount = 0
                  return Object.keys(holdings.holdingGroups)
                    .sort(
                      holdingState.groupBy.value === GroupBy.SECTOR
                        ? compareBySector
                        : compareByReportCategory,
                    )
                    .map((groupKey, index) => {
                      const currentCumulative = cumulativeCount
                      cumulativeCount +=
                        holdings.holdingGroups[groupKey].positions.length
                      return (
                        <React.Fragment key={groupKey}>
                          <Header
                            groupKey={groupKey}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            cumulativePositionCount={currentCumulative}
                            isFirstGroup={index === 0}
                          />
                          <Rows
                            portfolio={holdingResults.portfolio}
                            groupBy={groupKey}
                            holdingGroup={holdings.holdingGroups[groupKey]}
                            valueIn={holdingState.valueIn.value}
                            onColumnsChange={setColumns}
                          />
                          <SubTotal
                            groupBy={groupKey}
                            subTotals={
                              holdings.holdingGroups[groupKey].subTotals
                            }
                            valueIn={holdingState.valueIn.value}
                            positionCount={
                              holdings.holdingGroups[groupKey].positions.length
                            }
                          />
                        </React.Fragment>
                      )
                    })
                })()}
                <GrandTotal
                  holdings={holdings}
                  valueIn={holdingState.valueIn.value}
                />
              </table>
            </div>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 gap-3">
            <CardView
              holdings={holdings}
              portfolio={holdingResults.portfolio}
              valueIn={holdingState.valueIn.value}
              groupBy={holdingState.groupBy.value}
              isMixedCurrencies={holdingResults.isMixedCurrencies}
            />
          </div>
        ) : viewMode === "heatmap" ? (
          <div className="grid grid-cols-1 gap-3">
            <HoldingsHeader
              portfolio={holdingResults.portfolio}
              holdings={holdings}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isAggregated={true}
            />
            <PerformanceHeatmap
              holdingGroups={holdings.holdingGroups}
              valueIn={holdingState.valueIn.value}
              groupBy={holdingState.groupBy.value}
              viewByGroup={true}
              portfolioTotalValue={holdings.viewTotals.marketValue}
            />
          </div>
        ) : viewMode === "income" ? (
          <div className="grid grid-cols-1 gap-3">
            <HoldingsHeader
              portfolio={holdingResults.portfolio}
              holdings={holdings}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isAggregated={true}
            />
            <IncomeView
              portfolio={holdingResults.portfolio}
              portfolioIds={portfolioCodes.length > 0 ? undefined : undefined}
              isAggregated={true}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <HoldingsHeader
              portfolio={holdingResults.portfolio}
              holdings={holdings}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isAggregated={true}
            />
            <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
              <AllocationChart
                data={allocationData}
                totalValue={allocationTotalValue}
                currencySymbol={holdingResults.portfolio.currency.symbol}
                excludedCategories={excludedCategories}
                onToggleCategory={handleToggleCategory}
              />
            </div>
          </div>
        )}
        <CopyPopup
          columns={columns}
          data={holdingResults.positions}
          valueIn={holdingState.valueIn.value}
          modalOpen={copyModalOpen}
          onClose={() => setCopyModalOpen(false)}
        />
      </div>
    </>
  )
}

export default withPageAuthRequired(AggregatedHoldingsPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
