import React, { useCallback, useMemo, useState } from "react"
import {
  TableSkeletonLoader,
  SummarySkeletonLoader,
} from "@components/ui/SkeletonLoader"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import useSwr, { mutate as globalMutate } from "swr"
import dynamic from "next/dynamic"
import {
  simpleFetcher,
  portfoliosKey,
  ccyKey,
  categoriesKey,
} from "@utils/api/fetchHelper"
import {
  USER_ASSET_CATEGORIES,
  type CategoryOption,
  type SectorInfo,
  type SectorOption,
} from "@components/features/accounts/accountTypes"
import { currencyOptions } from "@lib/currency"
import { errorOut } from "@components/errors/ErrorOut"
const EditAccountDialog = dynamic(
  () => import("@components/features/accounts/EditAccountDialog"),
  { ssr: false },
)
const AdminAssetEditDialog = dynamic(
  () => import("@components/features/admin/AdminAssetEditDialog"),
  { ssr: false },
)
import { useHoldingState } from "@lib/holdings/holdingState"
import { useHoldingsView } from "@lib/holdings/useHoldingsView"
import {
  buildAggregateWeightByAssetId,
  indexBreakdownByAssetId,
  resolveTarget,
  tradeSeedForRow,
} from "@lib/holdings/aggregatedActions"
import HoldingsHeader from "@components/features/holdings/HoldingsHeader"
import HoldingMenu from "@components/features/holdings/HoldingMenu"
import Rows from "@components/features/holdings/Rows"
import PriceChartPopup from "@components/features/holdings/PriceChartPopup"
import PortfolioBreakdownPopup from "@components/features/holdings/PortfolioBreakdownPopup"
import SetCashBalanceDialog from "@components/features/holdings/SetCashBalanceDialog"
import TradeInputForm from "@components/features/transactions/TradeInputForm"
import {
  Asset,
  AssetCategory,
  Portfolio,
  PortfolioBreakdown,
  PortfolioBreakdownData,
  PriceChartData,
  QuickSellData,
  SetCashBalanceData,
} from "types/beancounter"
import SubTotal from "@components/features/holdings/SubTotal"
import ColumnHeader from "@components/features/holdings/Header"
import GroupBar from "@components/features/holdings/GroupBar"
import GrandTotal from "@components/features/holdings/GrandTotal"
import { useStickyHeaderOffset } from "@lib/holdings/useStickyHeaderOffset"
import PerformanceHeatmap from "@components/ui/PerformanceHeatmap"
import SummaryView from "@components/features/holdings/SummaryView"
import CardView from "@components/features/holdings/CardView"
import AllocationChart from "@components/features/allocation/AllocationChart"
import { getGroupComparator } from "@lib/categoryMapping"
import { useGroupOptions } from "@components/features/holdings/GroupByOptions"
import CopyPopup from "@components/ui/CopyPopup"
import { COPYABLE_HOLDING_COLUMNS } from "@components/features/holdings/constants"
import IncomeView from "@components/features/holdings/IncomeView"
import { VIEW_MODES } from "@components/features/holdings/ViewToggle"
import {
  ViewModeIcon,
  GroupByIcon,
} from "@components/features/holdings/HoldingActions"
import { usePermissions } from "@hooks/usePermissions"
import { usePortfolioReview } from "@components/features/holdings/usePortfolioReview"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

const viewModes = VIEW_MODES

function AggregatedHoldingsPage(): React.ReactElement {
  const router = useRouter()
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()
  const { preferences } = useUserPreferences()
  const {
    ai: canRunAi,
    admin: isAdmin,
    isLoading: permsLoading,
  } = usePermissions()
  const { popup: reviewPopup, showReview } = usePortfolioReview()
  // Get portfolio codes from URL query parameter
  const codes = router.query.codes as string | undefined
  const portfolioCodes = useMemo(() => (codes ? codes.split(",") : []), [codes])

  // Report aggregate values in the user's preferred reporting currency
  // (falling back to base). Without this the backend prices the consolidated
  // bucket in the first portfolio's currency, which is wrong for users whose
  // reporting currency differs from that portfolio (e.g. SGD shown as USD).
  const reportCurrency =
    preferences?.reportingCurrencyCode || preferences?.baseCurrencyCode

  // Build the API URL with optional codes + currency parameters
  const aggregatedHoldingsKey = codes
    ? `/api/holdings/aggregated?asAt=today&codes=${encodeURIComponent(codes)}`
    : "/api/holdings/aggregated?asAt=today"
  const aggregatedHoldingsUrl = reportCurrency
    ? `${aggregatedHoldingsKey}&currency=${encodeURIComponent(reportCurrency)}`
    : aggregatedHoldingsKey

  const { data, error, isLoading, mutate } = useSwr(
    aggregatedHoldingsUrl,
    simpleFetcher(aggregatedHoldingsUrl),
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
  const [columns, setColumns] = useState<string[]>([
    ...COPYABLE_HOLDING_COLUMNS,
  ])
  // Collapsed table sections (by groupKey). Default: all expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set<string>(),
  )
  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])
  // Measure the sticky column header so per-group bars pin just beneath it.
  const { ref: columnHeaderRef, offset: headerOffset } =
    useStickyHeaderOffset<HTMLTableSectionElement>()
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [priceChartData, setPriceChartData] = useState<
    PriceChartData | undefined
  >(undefined)
  const [portfolioBreakdownData, setPortfolioBreakdownData] = useState<
    PortfolioBreakdownData | undefined
  >(undefined)

  const handlePriceChart = useCallback((data: PriceChartData) => {
    setPriceChartData(data)
  }, [])
  const handlePriceChartClose = useCallback(() => {
    setPriceChartData(undefined)
  }, [])
  const handlePortfolioBreakdown = useCallback(
    (data: PortfolioBreakdownData) => {
      setPortfolioBreakdownData(data)
    },
    [],
  )
  const handlePortfolioBreakdownClose = useCallback(() => {
    setPortfolioBreakdownData(undefined)
  }, [])

  // Edit-asset state. Asset metadata is global (not portfolio-scoped), so
  // editing works the same in the aggregate view as on a single portfolio —
  // no target-portfolio resolution needed.
  const [editAsset, setEditAsset] = useState<Asset | undefined>(undefined)
  const [adminEditAsset, setAdminEditAsset] = useState<Asset | undefined>(
    undefined,
  )

  // Lazy-fetch the same reference data as the accounts page — only after the
  // user opens the edit dialog. Holdings is a hot path; editing is incidental.
  const { data: ccyData } = useSwr(
    editAsset ? ccyKey : null,
    simpleFetcher(ccyKey),
  )
  const { data: categoriesData } = useSwr(
    editAsset ? categoriesKey : null,
    simpleFetcher(categoriesKey),
  )
  const { data: sectorsData } = useSwr<{ data: SectorInfo[] }>(
    editAsset ? "/api/classifications/sectors" : null,
    simpleFetcher("/api/classifications/sectors"),
  )
  const ccyOptions = ccyData?.data ? currencyOptions(ccyData.data) : []
  const categoryOptions: CategoryOption[] = categoriesData?.data
    ? categoriesData.data
        .filter((cat: AssetCategory) => USER_ASSET_CATEGORIES.includes(cat.id))
        .map((cat: AssetCategory) => ({ value: cat.id, label: cat.name }))
    : []
  const sectorOptions: SectorOption[] = sectorsData?.data
    ? sectorsData.data.map((sector: SectorInfo) => ({
        value: sector.name,
        label: sector.name,
      }))
    : []

  const handleEditAsset = useCallback(
    (asset: Asset) => {
      // PRIVATE assets are user-owned → use the existing owner-scoped dialog.
      // Non-PRIVATE assets are public; only admins can edit those, and they
      // go through the slim admin dialog (category / name / sector only).
      if (asset.market?.code === "PRIVATE") {
        setEditAsset(asset)
      } else if (isAdmin) {
        setAdminEditAsset(asset)
      }
    },
    [isAdmin],
  )

  const handleEditAssetClose = useCallback(() => {
    setEditAsset(undefined)
  }, [])

  const handleEditAssetSave = useCallback(
    async (
      assetId: string,
      code: string,
      name: string,
      currency: string,
      category: string,
      sector?: string,
      expectedReturnRate?: number,
    ): Promise<void> => {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: "PRIVATE",
          code,
          name,
          currency,
          category,
          expectedReturnRate,
        }),
      })
      if (!response.ok) {
        throw new Error("Failed to update asset")
      }
      if (sector) {
        try {
          await fetch(`/api/classifications/${assetId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sector }),
          })
        } catch (err) {
          console.error("Failed to update sector classification:", err)
        }
      }
      // Refresh aggregated holdings + the assets list (accounts page cache)
      await mutate()
      await globalMutate("/api/assets")
      setEditAsset(undefined)
    },
    [mutate],
  )

  // --- Aggregated trading -------------------------------------------------
  // The aggregated context portfolio is synthetic, so actions must target a
  // real portfolio. We resolve it from each asset's portfolioBreakdown: act
  // directly when held in one, prompt to choose when held in several.
  const { data: portfoliosData } = useSwr<{ data: Portfolio[] }>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const portfolioById = useMemo(() => {
    const map = new Map<string, Portfolio>()
    for (const p of portfoliosData?.data ?? []) map.set(p.id, p)
    return map
  }, [portfoliosData])

  const breakdownByAssetId = useMemo(
    () => indexBreakdownByAssetId(holdings?.holdingGroups ?? {}),
    [holdings],
  )
  const assetById = useMemo(() => {
    const map = new Map<string, Asset>()
    for (const group of Object.values(holdings?.holdingGroups ?? {})) {
      for (const pos of group.positions) map.set(pos.asset.id, pos.asset)
    }
    return map
  }, [holdings])
  // Each asset's weight within the aggregate, so the trade form shows the
  // aggregate weight rather than the position's weight in its source portfolio.
  const aggregateWeightByAssetId = useMemo(
    () =>
      buildAggregateWeightByAssetId(
        holdings?.holdingGroups ?? {},
        holdingState.valueIn.value,
      ),
    [holdings, holdingState.valueIn.value],
  )

  // Trade modal bound to the resolved portfolio
  const [tradePortfolio, setTradePortfolio] = useState<Portfolio | undefined>(
    undefined,
  )
  const [quickSellData, setQuickSellData] = useState<QuickSellData | undefined>(
    undefined,
  )
  // Aggregate weight basis for the trade form (current weight + slider denominator)
  const [tradeWeight, setTradeWeight] = useState<
    { currentWeight: number | null; marketValue: number } | undefined
  >(undefined)
  // Set-balance dialog bound to the resolved portfolio
  const [cashPortfolio, setCashPortfolio] = useState<Portfolio | undefined>(
    undefined,
  )
  const [cashBalanceData, setCashBalanceData] = useState<
    SetCashBalanceData | undefined
  >(undefined)
  // Portfolio chooser for assets held in multiple portfolios
  const [pendingChoice, setPendingChoice] = useState<{
    asset?: Asset
    title: string
    options: PortfolioBreakdown[]
    onPick: (row: PortfolioBreakdown) => void
  } | null>(null)

  // Resolve the target portfolio for an asset, then run `act`. Held in one →
  // run immediately; held in several → open the chooser; held in none → no-op.
  const withTargetPortfolio = useCallback(
    (
      assetId: string | undefined,
      title: string,
      act: (portfolio: Portfolio, row: PortfolioBreakdown) => void,
    ): void => {
      const resolution = resolveTarget(
        assetId ? breakdownByAssetId.get(assetId) : undefined,
      )
      if (resolution.kind === "none") return
      const run = (row: PortfolioBreakdown): void => {
        const portfolio = portfolioById.get(row.portfolioId)
        if (portfolio) act(portfolio, row)
      }
      if (resolution.kind === "direct") {
        run(resolution.target)
        return
      }
      setPendingChoice({
        asset: assetId ? assetById.get(assetId) : undefined,
        title,
        options: resolution.options,
        onPick: run,
      })
    },
    [breakdownByAssetId, portfolioById, assetById],
  )

  const openTrade = useCallback(
    (data: QuickSellData, type: NonNullable<QuickSellData["type"]>): void => {
      withTargetPortfolio(
        data.assetId,
        `${data.asset} — choose portfolio`,
        (portfolio, row) => {
          setTradePortfolio(portfolio)
          // Selling acts on the chosen portfolio's holding, not the aggregate.
          setQuickSellData(tradeSeedForRow(data, row, type))
          // Weight is expressed against the aggregate, not the source portfolio.
          setTradeWeight({
            currentWeight: data.assetId
              ? (aggregateWeightByAssetId.get(data.assetId) ?? null)
              : null,
            marketValue: holdings?.viewTotals.marketValue ?? 0,
          })
        },
      )
    },
    [withTargetPortfolio, aggregateWeightByAssetId, holdings],
  )

  const handleTrade = useCallback(
    (data: QuickSellData) => openTrade(data, "BUY"),
    [openTrade],
  )
  const handleQuickSell = useCallback(
    (data: QuickSellData) => openTrade(data, "SELL"),
    [openTrade],
  )
  const handleRecordIncome = useCallback(
    (data: QuickSellData) => openTrade(data, "INCOME"),
    [openTrade],
  )
  const handleRecordExpense = useCallback(
    (data: QuickSellData) => openTrade(data, "EXPENSE"),
    [openTrade],
  )

  const handleSetCashBalance = useCallback(
    (data: SetCashBalanceData) => {
      withTargetPortfolio(
        data.assetId,
        `${data.assetCode ?? data.currency} — choose portfolio`,
        (portfolio) => {
          setCashPortfolio(portfolio)
          setCashBalanceData(data)
        },
      )
    },
    [withTargetPortfolio],
  )

  const handleGoToPortfolio = useCallback(
    (asset: Asset) => {
      const resolution = resolveTarget(breakdownByAssetId.get(asset.id))
      if (resolution.kind === "none") return
      if (resolution.kind === "direct") {
        router.push(`/holdings/${resolution.target.portfolioCode}`)
        return
      }
      // Multiple holders → reuse the breakdown popup (navigates on select)
      setPortfolioBreakdownData({ asset, breakdown: resolution.options })
    },
    [breakdownByAssetId, router],
  )

  const handleTradeClose = useCallback((open: boolean) => {
    if (!open) {
      setQuickSellData(undefined)
      setTradePortfolio(undefined)
    }
  }, [])
  const handleCashBalanceClose = useCallback(() => {
    setCashBalanceData(undefined)
    setCashPortfolio(undefined)
  }, [])

  // Determine the subtitle based on selected portfolios
  const subtitle = useMemo(() => {
    if (portfolioCodes.length === 0) {
      return "Showing holdings across all portfolios"
    }
    if (portfolioCodes.length === 1) {
      return `Showing holdings for ${portfolioCodes[0]}`
    }
    return `Showing holdings for ${portfolioCodes.length} portfolios`
  }, [portfolioCodes])

  if (error) {
    return errorOut("Failed to load aggregated holdings", error)
  }

  if (isLoading) {
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
          <div className="text-gray-600">{"No holdings found"}</div>
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
      <div className="w-full py-2">
        <div className="mb-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {"Aggregated Holdings"}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </div>
        {/* Single-row icon ribbon - matches HoldingActions toolbar */}
        <div className="flex items-center justify-between py-1 mb-1 gap-1.5 overflow-x-auto">
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* View Mode section */}
            <div className="flex items-center gap-0.5 bg-slate-100/80 backdrop-blur-sm rounded-lg p-0.5 border border-slate-200/60 shadow-sm">
              {viewModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setViewMode(mode.value)}
                  className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
                    viewMode === mode.value
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                  }`}
                  aria-label={`${mode.label} view`}
                  title={mode.label}
                >
                  <ViewModeIcon
                    mode={mode.value}
                    className={`w-3.5 h-3.5 ${viewMode === mode.value ? "text-blue-500" : ""}`}
                  />
                </button>
              ))}
            </div>

            {/* GroupBy section */}
            <div className="flex items-center gap-0.5 bg-amber-50/80 backdrop-blur-sm rounded-lg p-0.5 border border-amber-200/60 shadow-sm">
              {groupOptions.values.map((option) => (
                <button
                  key={option.value}
                  onClick={() => holdingState.setGroupBy(option)}
                  className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
                    holdingState.groupBy.value === option.value
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-amber-200/50"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                  }`}
                  aria-label={option.label}
                  title={option.label}
                >
                  <GroupByIcon
                    groupBy={option.value}
                    className={`w-3.5 h-3.5 ${holdingState.groupBy.value === option.value ? "text-amber-500" : ""}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right side: icon-only action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!permsLoading && canRunAi && (
              <button
                type="button"
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shadow-sm bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 hover:ring-slate-300"
                onClick={() =>
                  showReview({ kind: "aggregated", codes: portfolioCodes })
                }
                aria-label="AI summary of aggregated holdings"
                title="AI summary: headwinds, tailwinds, key news on winners and losers"
              >
                <i className="fas fa-robot text-xs text-blue-500"></i>
              </button>
            )}
            <button
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shadow-sm bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 hover:ring-slate-300"
              onClick={() => setCopyModalOpen(true)}
              aria-label="Copy Data"
              title="Copy Data"
            >
              <i className="fas fa-copy text-xs text-blue-500"></i>
            </button>
            <button
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shadow-sm bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() => {
                const portfolioParams = codes
                  ? `?portfolios=${encodeURIComponent(codes)}`
                  : ""
                router.push(`/rebalance/wizard${portfolioParams}`)
              }}
              aria-label="Invest"
              title="Invest"
            >
              <i className="fas fa-balance-scale text-xs"></i>
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
                <ColumnHeader
                  ref={columnHeaderRef}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                {Object.keys(holdings.holdingGroups)
                  .sort(getGroupComparator(holdingState.groupBy.value))
                  .map((groupKey) => {
                    const isCollapsed = collapsedGroups.has(groupKey)
                    return (
                      <React.Fragment key={groupKey}>
                        <GroupBar
                          groupBy={groupKey}
                          subTotals={holdings.holdingGroups[groupKey].subTotals}
                          valueIn={holdingState.valueIn.value}
                          isCollapsed={isCollapsed}
                          onToggleCollapse={() => toggleGroup(groupKey)}
                          stickyTop={headerOffset}
                        />
                        {!isCollapsed && (
                          <>
                            <Rows
                              portfolio={holdingResults.portfolio}
                              groupBy={groupKey}
                              holdingGroup={holdings.holdingGroups[groupKey]}
                              valueIn={holdingState.valueIn.value}
                              onColumnsChange={setColumns}
                              onPriceChart={handlePriceChart}
                              onPortfolioBreakdown={handlePortfolioBreakdown}
                              onTrade={handleTrade}
                              onQuickSell={handleQuickSell}
                              onRecordIncome={handleRecordIncome}
                              onRecordExpense={handleRecordExpense}
                              onSetCashBalance={handleSetCashBalance}
                              onGoToPortfolio={handleGoToPortfolio}
                              onEditAsset={handleEditAsset}
                            />
                            <SubTotal
                              groupBy={groupKey}
                              subTotals={
                                holdings.holdingGroups[groupKey].subTotals
                              }
                              valueIn={holdingState.valueIn.value}
                              positionCount={
                                holdings.holdingGroups[groupKey].positions
                                  .length
                              }
                            />
                          </>
                        )}
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
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 gap-3">
            <CardView
              key={holdingState.groupBy.value}
              holdings={holdings}
              portfolio={holdingResults.portfolio}
              valueIn={holdingState.valueIn.value}
              groupBy={holdingState.groupBy.value}
              isMixedCurrencies={holdingResults.isMixedCurrencies}
              onPriceChart={handlePriceChart}
              onPortfolioBreakdown={handlePortfolioBreakdown}
              onTrade={handleTrade}
              onQuickSell={handleQuickSell}
              onRecordIncome={handleRecordIncome}
              onRecordExpense={handleRecordExpense}
              onSetCashBalance={handleSetCashBalance}
              onGoToPortfolio={handleGoToPortfolio}
              onEditAsset={handleEditAsset}
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
              portfolio={holdingResults.portfolio}
              viewByGroup={false}
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
        {priceChartData && (
          <PriceChartPopup
            asset={priceChartData.asset}
            currencySymbol={priceChartData.currencySymbol}
            portfolios={(
              breakdownByAssetId.get(priceChartData.asset.id) ?? []
            ).map((b) => b.portfolioId)}
            onClose={handlePriceChartClose}
          />
        )}
        {portfolioBreakdownData && (
          <PortfolioBreakdownPopup
            asset={portfolioBreakdownData.asset}
            breakdown={portfolioBreakdownData.breakdown}
            onClose={handlePortfolioBreakdownClose}
          />
        )}
        {pendingChoice && (
          <PortfolioBreakdownPopup
            asset={pendingChoice.asset}
            breakdown={pendingChoice.options}
            title={pendingChoice.title}
            onSelect={(row) => {
              const pick = pendingChoice.onPick
              setPendingChoice(null)
              pick(row)
            }}
            onClose={() => setPendingChoice(null)}
          />
        )}
        {quickSellData && tradePortfolio && (
          <TradeInputForm
            portfolio={tradePortfolio}
            modalOpen={true}
            setModalOpen={handleTradeClose}
            initialValues={quickSellData}
            weightBasisMarketValue={tradeWeight?.marketValue}
            currentWeightOverride={tradeWeight?.currentWeight}
          />
        )}
        {cashBalanceData && cashPortfolio && (
          <SetCashBalanceDialog
            modalOpen={true}
            onClose={handleCashBalanceClose}
            portfolio={cashPortfolio}
            currency={cashBalanceData.currency}
            currentBalance={cashBalanceData.currentBalance}
            market={cashBalanceData.market}
            assetCode={cashBalanceData.assetCode}
            assetName={cashBalanceData.assetName}
          />
        )}
        {editAsset && (
          <EditAccountDialog
            asset={editAsset}
            currencies={ccyOptions}
            categories={categoryOptions}
            sectors={sectorOptions}
            onClose={handleEditAssetClose}
            onSave={handleEditAssetSave}
          />
        )}
        {adminEditAsset && (
          <AdminAssetEditDialog
            asset={adminEditAsset}
            onClose={() => setAdminEditAsset(undefined)}
            onSaved={async () => {
              setAdminEditAsset(undefined)
              await mutate()
              await globalMutate("/api/assets")
            }}
          />
        )}
        {reviewPopup}
      </div>
    </>
  )
}

export default withPageAuthRequired(AggregatedHoldingsPage)
