import React, { useState, useMemo } from "react"
import { calculateHoldings } from "@lib/holdings/calculateHoldings"
import { Holdings } from "types/beancounter"
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
import { sortPositions, SortConfig } from "@lib/holdings/sortHoldings"
import SummaryHeader, {
  SummaryHeaderMobile,
  SummaryRow,
  SummaryRowMobile,
} from "@components/features/holdings/Summary"
import Rows from "@components/features/holdings/Rows"
import SubTotal from "@components/features/holdings/SubTotal"
import Header from "@components/features/holdings/Header"
import GrandTotal from "@components/features/holdings/GrandTotal"
import PerformanceHeatmap from "@components/ui/PerformanceHeatmap"
import ViewToggle, { ViewMode } from "@components/features/holdings/ViewToggle"
import AllocationChart from "@components/features/allocation/AllocationChart"
import AllocationControls from "@components/features/allocation/AllocationControls"
import {
  transformToAllocationSlices,
  GroupingMode,
} from "@lib/allocation/aggregateHoldings"

const sortOrder = ["Equity", "Exchange Traded Fund", "Cash", "RE"]

function AggregatedHoldingsPage(): React.ReactElement {
  const router = useRouter()
  const { t, ready } = useTranslation("common")
  const holdingState = useHoldingState()

  // Get portfolio codes from URL query parameter
  const codes = router.query.codes as string | undefined
  const portfolioCodes = useMemo(
    () => (codes ? codes.split(",") : []),
    [codes],
  )

  // Build the API URL with optional codes parameter
  const aggregatedHoldingsKey = codes
    ? `/api/holdings/aggregated?asAt=today&codes=${encodeURIComponent(codes)}`
    : "/api/holdings/aggregated?asAt=today"

  const { data, error, isLoading } = useSwr(
    aggregatedHoldingsKey,
    simpleFetcher(aggregatedHoldingsKey),
  )

  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [allocationGroupBy, setAllocationGroupBy] =
    useState<GroupingMode>("category")
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "assetName",
    direction: "asc",
  })

  // Handle sorting
  const handleSort = (key: string): void => {
    setSortConfig((prevConfig) => {
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === "asc" ? "desc" : "asc",
        }
      }
      return {
        key,
        direction: "desc",
      }
    })
  }

  // Calculate holdings and apply sorting
  const holdings = useMemo(() => {
    if (!data?.data) return null

    const calculatedHoldings = calculateHoldings(
      data.data,
      holdingState.hideEmpty,
      holdingState.valueIn.value,
      holdingState.groupBy.value,
    ) as Holdings

    // Apply sorting to each holding group
    if (sortConfig.key) {
      const sortedHoldingGroups = { ...calculatedHoldings.holdingGroups }
      Object.keys(sortedHoldingGroups).forEach((groupKey) => {
        sortedHoldingGroups[groupKey] = sortPositions(
          sortedHoldingGroups[groupKey],
          sortConfig,
          holdingState.valueIn.value,
        )
      })
      return {
        ...calculatedHoldings,
        holdingGroups: sortedHoldingGroups,
      }
    }
    return calculatedHoldings
  }, [
    data,
    holdingState.hideEmpty,
    holdingState.valueIn.value,
    holdingState.groupBy.value,
    sortConfig,
  ])

  // Calculate allocation data for allocation view
  const allocationData = useMemo(() => {
    if (!data?.data) return []
    return transformToAllocationSlices(
      data.data,
      allocationGroupBy,
      holdingState.valueIn.value,
    )
  }, [data, allocationGroupBy, holdingState.valueIn.value])

  const allocationTotalValue = useMemo(() => {
    return allocationData.reduce((sum, slice) => sum + slice.value, 0)
  }, [allocationData])

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
    return errorOut(t("holdings.error.aggregated", "Failed to load aggregated holdings"), error)
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

      {viewMode === "table" ? (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <SummaryHeaderMobile
              portfolio={holdingResults.portfolio}
              portfolioSummary={{
                totals: holdings.totals,
                currency: holdings.currency,
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <SummaryRowMobile
              totals={holdings.totals}
              currency={holdings.currency}
            />
            <table className="min-w-full bg-white">
              <SummaryHeader
                portfolio={holdingResults.portfolio}
                portfolioSummary={{
                  totals: holdings.totals,
                  currency: holdings.currency,
                }}
              />
              <SummaryRow />
            </table>
          </div>
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full bg-white">
              {Object.keys(holdings.holdingGroups)
                .sort((a, b) => {
                  return sortOrder.indexOf(a) - sortOrder.indexOf(b)
                })
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
          <div>
            <SummaryHeaderMobile
              portfolio={holdingResults.portfolio}
              portfolioSummary={{
                totals: holdings.totals,
                currency: holdings.currency,
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <SummaryRowMobile
              totals={holdings.totals}
              currency={holdings.currency}
            />
            <table className="min-w-full bg-white">
              <SummaryHeader
                portfolio={holdingResults.portfolio}
                portfolioSummary={{
                  totals: holdings.totals,
                  currency: holdings.currency,
                }}
              />
              <SummaryRow />
            </table>
          </div>
          <PerformanceHeatmap
            holdingGroups={holdings.holdingGroups}
            valueIn={holdingState.valueIn.value}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <SummaryHeaderMobile
              portfolio={holdingResults.portfolio}
              portfolioSummary={{
                totals: holdings.totals,
                currency: holdings.currency,
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <SummaryRowMobile
              totals={holdings.totals}
              currency={holdings.currency}
            />
            <table className="min-w-full bg-white">
              <SummaryHeader
                portfolio={holdingResults.portfolio}
                portfolioSummary={{
                  totals: holdings.totals,
                  currency: holdings.currency,
                }}
              />
              <SummaryRow />
            </table>
          </div>
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
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default withPageAuthRequired(AggregatedHoldingsPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
