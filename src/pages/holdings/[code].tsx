import React, { useState, useEffect, useMemo, useCallback } from "react"
import { calculateHoldings } from "@lib/holdings/calculateHoldings"
import {
  Holdings,
  QuickSellData,
  WeightClickData,
  RebalanceData,
} from "types/beancounter"
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
import { errorOut } from "@components/errors/ErrorOut"
import { useHoldingState } from "@lib/holdings/holdingState"
import { sortPositions, SortConfig } from "@lib/holdings/sortHoldings"
import HoldingMenu from "@components/features/holdings/HoldingMenu"
import SummaryHeader, {
  SummaryHeaderMobile,
  SummaryRow,
  SummaryRowMobile,
} from "@components/features/holdings/Summary"
import Rows, { CorporateActionsData } from "@components/features/holdings/Rows"
import SubTotal from "@components/features/holdings/SubTotal"
import Header from "@components/features/holdings/Header"
import GrandTotal from "@components/features/holdings/GrandTotal"
import HoldingActions from "@components/features/holdings/HoldingActions"
import PerformanceHeatmap from "@components/ui/PerformanceHeatmap"
import ViewToggle, { ViewMode } from "@components/features/holdings/ViewToggle"
import CorporateActionsPopup from "@components/features/holdings/CorporateActionsPopup"
import TargetWeightDialog from "@components/features/holdings/TargetWeightDialog"

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
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "assetName",
    direction: "asc",
  })
  const [quickSellData, setQuickSellData] = useState<QuickSellData | undefined>(
    undefined,
  )
  const [corporateActionsData, setCorporateActionsData] = useState<
    CorporateActionsData | undefined
  >(undefined)
  const [weightClickData, setWeightClickData] = useState<
    WeightClickData | undefined
  >(undefined)

  // Handle quick sell from position row
  const handleQuickSell = useCallback((data: QuickSellData) => {
    setQuickSellData(data)
  }, [])

  // Clear quick sell data when modal closes
  const handleQuickSellHandled = useCallback(() => {
    setQuickSellData(undefined)
  }, [])

  // Handle corporate actions popup
  const handleCorporateActions = useCallback((data: CorporateActionsData) => {
    setCorporateActionsData(data)
  }, [])

  // Close corporate actions popup
  const handleCorporateActionsClose = useCallback(() => {
    setCorporateActionsData(undefined)
  }, [])

  // Handle weight click from position row
  const handleWeightClick = useCallback((data: WeightClickData) => {
    setWeightClickData(data)
  }, [])

  // Close weight dialog
  const handleWeightDialogClose = useCallback(() => {
    setWeightClickData(undefined)
  }, [])

  // Handle rebalance confirmation - convert to QuickSellData format and open trade modal
  const handleRebalanceConfirm = useCallback((data: RebalanceData) => {
    setQuickSellData({
      asset: data.asset,
      market: data.market,
      quantity: data.quantity,
      price: data.price,
      type: data.type,
      currentPositionQuantity: data.currentPositionQuantity,
    })
    setWeightClickData(undefined)
  }, [])

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
          quickSellData={quickSellData}
          onQuickSellHandled={handleQuickSellHandled}
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
      <div className="mobile-portrait:hidden flex justify-between items-center mb-4">
        <HoldingActions
          holdingResults={holdingResults}
          columns={columns}
          valueIn={holdingState.valueIn.value}
          quickSellData={quickSellData}
          onQuickSellHandled={handleQuickSellHandled}
        />
        {/* Desktop view toggle - hidden on mobile/tablet */}
        <div className="hidden xl:block">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="grid grid-cols-1 gap-3">
          <div>
            {/* Mobile/Tablet header - must be outside table */}
            <SummaryHeaderMobile
              portfolio={holdingResults.portfolio}
              portfolioSummary={{
                totals: holdings.totals,
                currency: holdings.currency,
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {/* Mobile/Tablet summary row - must be outside table */}
            <SummaryRowMobile
              totals={holdings.totals}
              currency={holdings.currency}
            />
            {/* Desktop table with thead */}
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
                        onColumnsChange={setColumns}
                        onQuickSell={handleQuickSell}
                        onCorporateActions={handleCorporateActions}
                        onWeightClick={handleWeightClick}
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
            {/* Mobile/Tablet header - must be outside table */}
            <SummaryHeaderMobile
              portfolio={holdingResults.portfolio}
              portfolioSummary={{
                totals: holdings.totals,
                currency: holdings.currency,
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {/* Mobile/Tablet summary row - must be outside table */}
            <SummaryRowMobile
              totals={holdings.totals}
              currency={holdings.currency}
            />
            {/* Desktop table with thead */}
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
      )}
      {corporateActionsData && (
        <CorporateActionsPopup
          asset={corporateActionsData.asset}
          portfolioId={corporateActionsData.portfolioId}
          fromDate={corporateActionsData.fromDate}
          toDate={holdingState.asAt}
          modalOpen={!!corporateActionsData}
          onClose={handleCorporateActionsClose}
        />
      )}
      {weightClickData && (
        <TargetWeightDialog
          modalOpen={!!weightClickData}
          onClose={handleWeightDialogClose}
          onConfirm={handleRebalanceConfirm}
          asset={weightClickData.asset}
          portfolio={holdingResults.portfolio}
          currentWeight={weightClickData.currentWeight}
          currentQuantity={weightClickData.currentQuantity}
          currentPrice={weightClickData.currentPrice}
        />
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
