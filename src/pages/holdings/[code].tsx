import React, { useState, useEffect, useCallback } from "react"
import {
  QuickSellData,
  WeightClickData,
  RebalanceData,
  SetCashBalanceData,
  SetPriceData,
  Asset,
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
import { useHoldingsView } from "@lib/holdings/useHoldingsView"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import HoldingMenu from "@components/features/holdings/HoldingMenu"
import HoldingsHeader from "@components/features/holdings/HoldingsHeader"
import Rows, {
  CorporateActionsData,
  SectorWeightingsData,
} from "@components/features/holdings/Rows"
import SectorWeightingsPopup from "@components/features/holdings/SectorWeightingsPopup"
import SubTotal from "@components/features/holdings/SubTotal"
import Header from "@components/features/holdings/Header"
import GrandTotal from "@components/features/holdings/GrandTotal"
import HoldingActions from "@components/features/holdings/HoldingActions"
import PerformanceHeatmap from "@components/ui/PerformanceHeatmap"
import SummaryView from "@components/features/holdings/SummaryView"
import CardView from "@components/features/holdings/CardView"
import { compareByReportCategory, compareBySector } from "@lib/categoryMapping"
import { GroupBy } from "@components/features/holdings/GroupByOptions"
import HoldingsToolbar from "@components/features/holdings/HoldingsToolbar"
import CorporateActionsPopup from "@components/features/holdings/CorporateActionsPopup"
import TargetWeightDialog from "@components/features/holdings/TargetWeightDialog"
import SetCashBalanceDialog from "@components/features/holdings/SetCashBalanceDialog"
import SetPriceDialog from "@components/features/holdings/SetPriceDialog"
import TrnDropZone from "@components/ui/DropZone"

function HoldingsPage(): React.ReactElement {
  const router = useRouter()
  const { t, ready } = useTranslation("common")
  const holdingState = useHoldingState()
  const { preferences } = useUserPreferences()
  const { data, error, isLoading } = useSwr(
    holdingKey(`${router.query.code}`, `${holdingState.asAt}`),
    simpleFetcher(holdingKey(`${router.query.code}`, `${holdingState.asAt}`)),
  )

  // Use shared hook for view state and calculations
  const {
    viewMode,
    setViewMode,
    sortConfig,
    allocationGroupBy,
    handleSort,
    holdings,
    allocationData,
  } = useHoldingsView(data?.data)

  // Page-specific state
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [columns, setColumns] = useState<string[]>([])
  const [quickSellData, setQuickSellData] = useState<QuickSellData | undefined>(
    undefined,
  )
  const [corporateActionsData, setCorporateActionsData] = useState<
    CorporateActionsData | undefined
  >(undefined)
  const [weightClickData, setWeightClickData] = useState<
    WeightClickData | undefined
  >(undefined)
  const [setCashBalanceData, setSetCashBalanceData] = useState<
    SetCashBalanceData | undefined
  >(undefined)
  const [setPriceData, setSetPriceData] = useState<SetPriceData | undefined>(
    undefined,
  )
  const [sectorWeightingsAsset, setSectorWeightingsAsset] = useState<
    Asset | undefined
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

  // Handle set cash balance from cash row - opens the dialog
  const handleSetCashBalance = useCallback((data: SetCashBalanceData) => {
    setSetCashBalanceData(data)
  }, [])

  // Close set cash balance dialog
  const handleSetCashBalanceDialogClose = useCallback(() => {
    setSetCashBalanceData(undefined)
  }, [])

  // Handle set price from position row
  const handleSetPrice = useCallback((data: SetPriceData) => {
    setSetPriceData(data)
  }, [])

  // Close set price dialog
  const handleSetPriceDialogClose = useCallback(() => {
    setSetPriceData(undefined)
  }, [])

  // Handle sector weightings popup for ETFs
  const handleSectorWeightings = useCallback((data: SectorWeightingsData) => {
    setSectorWeightingsAsset(data.asset)
  }, [])

  // Close sector weightings popup
  const handleSectorWeightingsClose = useCallback(() => {
    setSectorWeightingsAsset(undefined)
  }, [])

  // Save price via API
  const handleSetPriceSave = useCallback(
    async (assetId: string, date: string, price: string): Promise<void> => {
      const response = await fetch("/api/prices/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          date,
          closePrice: parseFloat(price),
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || "Failed to set price")
      }
      setSetPriceData(undefined)
      // Refresh holdings data
      router.replace(router.asPath)
    },
    [router],
  )

  useEffect(() => {
    if (router.query.action === "trade") {
      setTradeModalOpen(true)
    } else if (router.query.action === "cash") {
      setCashModalOpen(true)
    }
  }, [router.query.action, cashModalOpen, tradeModalOpen])

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
      <div className="w-full py-4">
        <HoldingActions
          holdingResults={holdingResults}
          columns={columns}
          valueIn={holdingState.valueIn.value}
          quickSellData={quickSellData}
          onQuickSellHandled={handleQuickSellHandled}
          emptyHoldings={true}
        />
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mt-4">
          <p className="text-gray-600 mb-6">
            {t("holdings.empty", { code: holdingResults.portfolio.code })}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {t("holdings.import.hint")}
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 inline-block cursor-pointer hover:border-gray-400 transition-colors">
            <i className="fas fa-file-csv text-4xl text-gray-400 mb-2"></i>
            <TrnDropZone
              portfolio={holdingResults.portfolio}
              purge={false}
              hideIcon={true}
            />
            <p className="text-sm text-gray-500 mt-2">
              {t("holdings.import.select")}
            </p>
          </div>
        </div>
      </div>
    )
  }
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

      {/* Actions bar - visible on tablet/desktop */}
      <div className="mobile-portrait:hidden mb-4">
        <HoldingActions
          holdingResults={holdingResults}
          columns={columns}
          valueIn={holdingState.valueIn.value}
          quickSellData={quickSellData}
          onQuickSellHandled={handleQuickSellHandled}
          viewMode={viewMode}
          allocationData={allocationData}
          holdings={holdings}
        />
      </div>

      {viewMode === "summary" ? (
        <div className="grid grid-cols-1 gap-3">
          <HoldingsToolbar viewMode={viewMode} onViewModeChange={setViewMode} />
          <HoldingsHeader
            portfolio={holdingResults.portfolio}
            holdings={holdings}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            mobileOnly
          />
          <SummaryView
            holdings={holdings}
            allocationData={allocationData}
            groupBy={allocationGroupBy}
          />
        </div>
      ) : viewMode === "table" ? (
        <div className="grid grid-cols-1 gap-3">
          <HoldingsToolbar viewMode={viewMode} onViewModeChange={setViewMode} />
          <HoldingsHeader
            portfolio={holdingResults.portfolio}
            holdings={holdings}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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
                          onQuickSell={handleQuickSell}
                          onCorporateActions={handleCorporateActions}
                          onWeightClick={handleWeightClick}
                          onSetCashBalance={handleSetCashBalance}
                          onSetPrice={handleSetPrice}
                          onSectorWeightings={handleSectorWeightings}
                        />
                        <SubTotal
                          groupBy={groupKey}
                          subTotals={holdings.holdingGroups[groupKey].subTotals}
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
          <HoldingsToolbar viewMode={viewMode} onViewModeChange={setViewMode} />
          <CardView
            holdings={holdings}
            portfolio={holdingResults.portfolio}
            valueIn={holdingState.valueIn.value}
            groupBy={holdingState.groupBy.value}
          />
        </div>
      ) : viewMode === "heatmap" ? (
        <div className="grid grid-cols-1 gap-3">
          <HoldingsToolbar viewMode={viewMode} onViewModeChange={setViewMode} />
          <HoldingsHeader
            portfolio={holdingResults.portfolio}
            holdings={holdings}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <PerformanceHeatmap
            holdingGroups={holdings.holdingGroups}
            valueIn={holdingState.valueIn.value}
            groupBy={holdingState.groupBy.value}
            viewByGroup={true}
            portfolioTotalValue={holdings.viewTotals.marketValue}
          />
        </div>
      ) : null}
      {corporateActionsData && (
        <CorporateActionsPopup
          asset={corporateActionsData.asset}
          portfolioId={corporateActionsData.portfolioId}
          fromDate={corporateActionsData.fromDate}
          toDate={holdingState.asAt}
          closedDate={corporateActionsData.closedDate}
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
      {setCashBalanceData && (
        <SetCashBalanceDialog
          modalOpen={!!setCashBalanceData}
          onClose={handleSetCashBalanceDialogClose}
          portfolio={holdingResults.portfolio}
          currency={setCashBalanceData.currency}
          currentBalance={setCashBalanceData.currentBalance}
          market={setCashBalanceData.market}
          assetCode={setCashBalanceData.assetCode}
          assetName={setCashBalanceData.assetName}
        />
      )}
      {setPriceData && (
        <SetPriceDialog
          asset={setPriceData.asset}
          onClose={handleSetPriceDialogClose}
          onSave={handleSetPriceSave}
        />
      )}
      {sectorWeightingsAsset && (
        <SectorWeightingsPopup
          asset={sectorWeightingsAsset}
          modalOpen={!!sectorWeightingsAsset}
          onClose={handleSectorWeightingsClose}
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
