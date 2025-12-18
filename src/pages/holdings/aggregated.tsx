import React, { useMemo } from "react"
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
import ViewToggle from "@components/features/holdings/ViewToggle"
import SummaryView from "@components/features/holdings/SummaryView"
import AllocationChart from "@components/features/allocation/AllocationChart"
import AllocationControls from "@components/features/allocation/AllocationControls"
import { compareByReportCategory } from "@lib/categoryMapping"

function AggregatedHoldingsPage(): React.ReactElement {
  const router = useRouter()
  const { t, ready } = useTranslation("common")
  const holdingState = useHoldingState()

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
    setAllocationGroupBy,
    excludedCategories,
    handleSort,
    handleToggleCategory,
    holdings,
    allocationData,
    allocationTotalValue,
  } = useHoldingsView(data?.data)

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("holdings.aggregated.title", "Aggregated Holdings")}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      {viewMode === "summary" ? (
        <SummaryView holdings={holdings} allocationData={allocationData} />
      ) : viewMode === "table" ? (
        <div className="grid grid-cols-1 gap-3">
          <HoldingsHeader
            portfolio={holdingResults.portfolio}
            holdings={holdings}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isAggregated={true}
          />
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full bg-white">
              {Object.keys(holdings.holdingGroups)
                .sort(compareByReportCategory)
                .map((groupKey) => {
                  return (
                    <React.Fragment key={groupKey}>
                      <Header
                        groupKey={groupKey}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <Rows
                        portfolio={holdingResults.portfolio}
                        groupBy={groupKey}
                        holdingGroup={holdings.holdingGroups[groupKey]}
                        valueIn={holdingState.valueIn.value}
                        onColumnsChange={() => {}}
                      />
                      <SubTotal
                        groupBy={groupKey}
                        subTotals={holdings.holdingGroups[groupKey].subTotals}
                        valueIn={holdingState.valueIn.value}
                      />
                    </React.Fragment>
                  )
                })}
              <GrandTotal
                holdings={holdings}
                valueIn={holdingState.valueIn.value}
              />
            </table>
          </div>
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
            <AllocationControls
              groupBy={allocationGroupBy}
              onGroupByChange={setAllocationGroupBy}
              valueIn={holdingState.valueIn.value}
              onValueInChange={() => {}}
              hideValueIn={true}
            />
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
