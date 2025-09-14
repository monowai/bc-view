import React, { useState, useEffect, useMemo } from "react"
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
import { holdingKey, simpleFetcher } from "@utils/api/fetchHelper"
import errorOut from "@components/errors/ErrorOut"
import { useHoldingState } from "@lib/holdings/holdingState"
import { sortPositions, SortConfig } from "@lib/holdings/sortHoldings"
import HoldingMenu from "@components/features/holdings/HoldingMenu"
import SummaryHeader, {
  SummaryRow,
} from "@components/features/holdings/Summary"
import Rows from "@components/features/holdings/Rows"
import SubTotal from "@components/features/holdings/SubTotal"
import Header from "@components/features/holdings/Header"
import GrandTotal from "@components/features/holdings/GrandTotal"
import HoldingActions from "@components/features/holdings/HoldingActions"
import PerformanceHeatmap from "@components/ui/PerformanceHeatmap"

function HoldingsPage(): React.ReactElement {
  const router = useRouter()
  const { t, ready } = useTranslation("common")
  const holdingState = useHoldingState()
  const { data, error, isLoading } = useSwr(
    holdingKey(`${router.query.code}`, `${holdingState.asAt}`),
    simpleFetcher(holdingKey(`${router.query.code}`, `${holdingState.asAt}`)),
  )

  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [columns, setColumns] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"table" | "heatmap">("table")
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "assetName",
    direction: "asc",
  })

  useEffect(() => {
    if (router.query.action === "trade") {
      setTradeModalOpen(true)
    } else if (router.query.action === "cash") {
      setCashModalOpen(true)
    }
  }, [router.query.action, cashModalOpen, tradeModalOpen])

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
      // New column clicked - start with DESC for better UX
      return {
        key,
        direction: "desc",
      }
    })
  }

  // Calculate holdings and apply sorting - moved before conditional returns
  const holdings = useMemo(() => {
    if (!data) return null

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

  if (error && ready) {
    console.error(error) // Log the error for debugging
    return errorOut(
      t("holdings.error.retrieve", { code: router.query.code }),
      error,
    )
  }
  if (isLoading) {
    return (
      <div className="w-full py-4">
        <HoldingMenu
          portfolio={{
            id: "",
            code: router.query.code as string,
            name: "Loading...",
            currency: { code: "", symbol: "", name: "" },
            base: { code: "", symbol: "", name: "" },
            marketValue: 0,
            irr: 0,
          }}
        />
        <SummarySkeletonLoader />
        <TableSkeletonLoader rows={8} />
      </div>
    )
  }
  const holdingResults = data.data
  if (Object.keys(holdingResults.positions).length === 0) {
    return (
      <div>
        <HoldingActions
          holdingResults={holdingResults}
          columns={columns}
          valueIn={holdingState.valueIn.value}
        />
        No Holdings for {holdingResults.portfolio.code}
      </div>
    )
  }
  const sortOrder = ["Equity", "Exchange Traded Fund", "Cash"]

  if (!holdings) {
    return (
      <div className="w-full py-4">
        <HoldingMenu portfolio={holdingResults.portfolio} />
        <SummarySkeletonLoader />
        <TableSkeletonLoader rows={8} />
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      <HoldingMenu portfolio={holdingResults.portfolio} />
      <div className="flex justify-between items-center mb-4">
        <HoldingActions
          holdingResults={holdingResults}
          columns={columns}
          valueIn={holdingState.valueIn.value}
        />
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === "table"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <svg
              className="w-4 h-4"
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
            <span>Table</span>
          </button>
          <button
            onClick={() => setViewMode("heatmap")}
            className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === "heatmap"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <svg
              className="w-4 h-4"
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
            <span>Heatmap</span>
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <table className="min-w-full bg-white">
              <SummaryHeader {...holdingResults.portfolio} />
              <SummaryRow
                totals={holdings.totals}
                currency={holdings.currency}
              />
            </table>
          </div>
          <div className="overflow-x-auto">
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
                        onColumnsChange={setColumns}
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
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <table className="min-w-full bg-white">
              <SummaryHeader {...holdingResults.portfolio} />
              <SummaryRow
                totals={holdings.totals}
                currency={holdings.currency}
              />
            </table>
          </div>
          <PerformanceHeatmap
            holdingGroups={holdings.holdingGroups}
            valueIn={holdingState.valueIn.value}
          />
        </div>
      )}
    </div>
  )
}

export default withPageAuthRequired(HoldingsPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
