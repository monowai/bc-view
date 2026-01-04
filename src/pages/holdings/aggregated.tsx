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
import { useUserPreferences } from "@contexts/UserPreferencesContext"
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
import { GroupBy } from "@components/features/holdings/GroupByOptions"
import HoldingsToolbar from "@components/features/holdings/HoldingsToolbar"
import CopyPopup from "@components/ui/CopyPopup"

function AggregatedHoldingsPage(): React.ReactElement {
  const router = useRouter()
  const { t, ready } = useTranslation("common")
  const holdingState = useHoldingState()
  const { preferences } = useUserPreferences()

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
        {/* Actions row - visible on tablet/desktop */}
        <div className="mobile-portrait:hidden flex py-2 space-x-2 mb-4">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
            onClick={() => setCopyModalOpen(true)}
          >
            <i className="fas fa-copy mr-2"></i>
            Copy Data
          </button>
          <button
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
            onClick={() => {
              const portfolioParams = codes
                ? `?portfolios=${encodeURIComponent(codes)}`
                : ""
              router.push(`/rebalance/wizard${portfolioParams}`)
            }}
          >
            <i className="fas fa-balance-scale mr-2"></i>
            Rebalance
          </button>
        </div>

        {viewMode === "summary" ? (
          <div className="grid grid-cols-1 gap-3">
            <HoldingsToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <SummaryView
              holdings={holdings}
              allocationData={allocationData}
              groupBy={allocationGroupBy}
            />
          </div>
        ) : viewMode === "table" ? (
          <div className="grid grid-cols-1 gap-3">
            <HoldingsToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <HoldingsHeader
              portfolio={holdingResults.portfolio}
              holdings={holdings}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isAggregated={true}
            />
            <div className="overflow-x-auto overflow-y-visible">
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
                            showWeightedIrr={preferences?.showWeightedIrr}
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
            <HoldingsToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <CardView
              holdings={holdings}
              portfolio={holdingResults.portfolio}
              valueIn={holdingState.valueIn.value}
              groupBy={holdingState.groupBy.value}
            />
          </div>
        ) : viewMode === "heatmap" ? (
          <div className="grid grid-cols-1 gap-3">
            <HoldingsToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
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
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <HoldingsToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
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
