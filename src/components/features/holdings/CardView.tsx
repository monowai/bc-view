import React, { useCallback, useMemo, useState } from "react"
import {
  Asset,
  CashTransferData,
  CostAdjustData,
  Currency,
  Holdings,
  MovePositionData,
  Portfolio,
  PortfolioBreakdownData,
  Position,
  PriceChartData,
  QuickSellData,
  SetBalanceData,
  SetCashBalanceData,
  SetPriceData,
} from "types/beancounter"
import { FormatValue, PrivateQuantity } from "@components/ui/MoneyUtils"
import {
  buildTradesHref,
  buildAggregatedTradesHref,
  getPositionDisplayName,
  isCashRelated,
  isConstantPrice,
  isNonTradeable,
  stripOwnerPrefix,
  supportsBalanceSetting,
} from "@lib/assets/assetUtils"
import { useDisplayCurrencyConversion } from "@lib/hooks/useDisplayCurrencyConversion"
import { getGroupComparator, isChartableCategory } from "@lib/categoryMapping"
import { useRouter } from "next/router"
import { AlphaProgress } from "@components/ui/ProgressBar"
import { QuickTooltip } from "@components/ui/Tooltip"
import AssetNewsButton from "@components/features/holdings/AssetNewsButton"
import { useNewsAsset } from "@components/features/holdings/useNewsAsset"
import {
  ActionsMenu,
  CashActionsMenu,
  CorporateActionsData,
  SectorWeightingsData,
} from "@components/features/holdings/ActionsMenus"

interface SharedActionHandlers {
  onTrade?: (data: QuickSellData) => void
  onQuickSell?: (data: QuickSellData) => void
  onCorporateActions?: (data: CorporateActionsData) => void
  onSetPrice?: (data: SetPriceData) => void
  onSetBalance?: (data: SetBalanceData) => void
  onSectorWeightings?: (data: SectorWeightingsData) => void
  onCostAdjust?: (data: CostAdjustData) => void
  onMovePosition?: (data: MovePositionData) => void
  onRecordIncome?: (data: QuickSellData) => void
  onRecordExpense?: (data: QuickSellData) => void
  onSetCashBalance?: (data: SetCashBalanceData) => void
  onCashTransfer?: (data: CashTransferData) => void
  onCashTransaction?: (assetCode: string, initialType?: string) => void
  onPriceChart?: (data: PriceChartData) => void
  onPortfolioBreakdown?: (data: PortfolioBreakdownData) => void
  onEditAsset?: (asset: Asset) => void
  onGoToPortfolio?: (asset: Asset) => void
}

interface CardViewProps extends SharedActionHandlers {
  holdings: Holdings
  portfolio: Portfolio
  valueIn: string
  groupBy?: string
  isMixedCurrencies?: boolean
  targetAssetId?: string
}

interface PositionCardProps extends SharedActionHandlers {
  position: Position
  portfolio: Portfolio
  valueIn: string
  sourceCurrency: Currency | undefined
}

// === Card subcomponents ===========================================

interface PositionMetricProps {
  label: string
  value: React.ReactNode
  align?: "left" | "center" | "right"
}

const PositionMetric: React.FC<PositionMetricProps> = ({
  label,
  value,
  align = "left",
}) => {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : ""
  return (
    <div className={alignClass}>
      <div className="text-gray-900 font-medium">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

interface PositionFooterProps {
  quantity: number
  precision: number
  price: number | undefined
  priceDate?: string
  weight: number
  currencySymbol: string
  onPriceClick?: (e: React.MouseEvent) => void
  priceAriaLabel?: string
  onQuantityClick?: (e: React.MouseEvent) => void
  quantityAriaLabel?: string
}

const PositionFooter: React.FC<PositionFooterProps> = ({
  quantity,
  precision,
  price,
  priceDate,
  weight,
  currencySymbol,
  onPriceClick,
  priceAriaLabel,
  onQuantityClick,
  quantityAriaLabel,
}) => {
  const priceText = (
    <>
      {currencySymbol}
      {price?.toFixed(2) || "-"}
    </>
  )
  const priceButton = onPriceClick ? (
    <button
      type="button"
      aria-label={priceAriaLabel}
      className="cursor-pointer hover:text-wealth-700 hover:underline underline-offset-2 decoration-dotted"
      onClick={onPriceClick}
    >
      {priceText}
    </button>
  ) : (
    priceText
  )
  // Surface the price's as-at date on hover (mirrors the table view, which
  // shows priceDate inline beneath the price).
  const priceValue = priceDate ? (
    <QuickTooltip text={`Price as at ${priceDate}`}>{priceButton}</QuickTooltip>
  ) : (
    priceButton
  )
  const quantityText = (
    <PrivateQuantity value={quantity} precision={precision} />
  )
  const quantityValue = onQuantityClick ? (
    <button
      type="button"
      aria-label={quantityAriaLabel}
      className="cursor-pointer hover:text-wealth-700 hover:underline underline-offset-2 decoration-dotted"
      onClick={onQuantityClick}
    >
      {quantityText}
    </button>
  ) : (
    quantityText
  )
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-sm">
      <PositionMetric label="Quantity" value={quantityValue} />
      <PositionMetric label="Price" align="center" value={priceValue} />
      <PositionMetric
        label="Weight"
        align="right"
        value={
          <>
            <FormatValue value={weight} multiplier={100} isPublic />%
          </>
        }
      />
    </div>
  )
}

interface PositionHeaderProps {
  asset: Position["asset"]
  displayName: string
  hasDistinctName: boolean
  truncatedName: string
  changePercent: number | undefined
  onShowNews: () => void
  actionsMenu?: React.ReactNode
}

const PositionHeader: React.FC<PositionHeaderProps> = ({
  asset,
  displayName,
  hasDistinctName,
  truncatedName,
  changePercent,
  onShowNews,
  actionsMenu,
}) => (
  <div className="flex justify-between items-center gap-2 mb-3">
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-1.5">
        {displayName}
        <AssetNewsButton asset={asset} onShow={onShowNews} />
      </h3>
      {hasDistinctName && (
        <p className="text-sm text-gray-500 truncate">{truncatedName}</p>
      )}
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {changePercent !== undefined && (
        <span
          className={`text-sm font-medium tabular-nums ${
            changePercent >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {changePercent > 0 ? "+" : ""}
          {(changePercent * 100).toFixed(2)}%
        </span>
      )}
      {actionsMenu}
    </div>
  </div>
)

interface PositionPnLProps {
  asset: Position["asset"]
  totalGain: number
  isPositive: boolean
  irr: number
  currencySymbol: string
}

const PositionPnL: React.FC<PositionPnLProps> = ({
  asset,
  totalGain,
  isPositive,
  irr,
  currencySymbol,
}) => (
  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
    <div>
      <div
        className={`text-lg font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}
      >
        {isPositive && totalGain > 0 ? "+" : ""}
        {currencySymbol}
        <FormatValue value={totalGain} />
      </div>
      <div className="text-sm text-gray-500">
        {isPositive ? "Your Profit" : "Your Loss"}
      </div>
    </div>
    {!isCashRelated(asset) && (
      <div className="text-right">
        <div
          className={`text-lg font-semibold ${irr >= 0 ? "text-green-600" : "text-red-600"}`}
        >
          {irr >= 0 ? "+" : ""}
          {(irr * 100).toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">Growth</div>
      </div>
    )}
  </div>
)

const CARD_CLASSNAME =
  "block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"

const PositionCard: React.FC<PositionCardProps> = ({
  position,
  portfolio,
  valueIn,
  sourceCurrency,
  onTrade,
  onQuickSell,
  onCorporateActions,
  onSetPrice,
  onSetBalance,
  onSectorWeightings,
  onCostAdjust,
  onMovePosition,
  onRecordIncome,
  onRecordExpense,
  onSetCashBalance,
  onCashTransfer,
  onCashTransaction,
  onPriceChart,
  onPortfolioBreakdown,
  onEditAsset,
  onGoToPortfolio,
}) => {
  const router = useRouter()
  const { popup, showNews } = useNewsAsset()
  const { asset, moneyValues, quantityValues, dateValues, portfolioBreakdown } =
    position
  const values = moneyValues[valueIn]

  const positionCurrency =
    valueIn === "TRADE" ? moneyValues.TRADE?.currency : sourceCurrency

  const { convert, currencySymbol } = useDisplayCurrencyConversion({
    sourceCurrency: positionCurrency,
    portfolio,
  })

  const marketValue = convert(values.marketValue)
  const totalGain = convert(values.totalGain)
  const isPositive = totalGain >= 0

  const displayName = getPositionDisplayName(asset)

  const name = asset.name || ""
  const hasDistinctName = name.length > 0 && name !== asset.code
  const truncatedName = name.length > 30 ? name.substring(0, 30) + "..." : name

  const tradesHref =
    portfolioBreakdown && portfolioBreakdown.length > 0
      ? buildAggregatedTradesHref(
          asset.id,
          portfolioBreakdown.map((b) => b.portfolioId),
        )
      : buildTradesHref(portfolio.id, asset.id)
  const cashLadderHref = `/trns/cash-ladder/${portfolio.id}/${asset.id}`

  const hasActions =
    !isCashRelated(asset) &&
    (!!onTrade ||
      !!onQuickSell ||
      !!onCorporateActions ||
      !!onCostAdjust ||
      !!onMovePosition ||
      !!onRecordIncome ||
      !!onRecordExpense ||
      (!!onSetPrice && asset.market?.code === "PRIVATE") ||
      (!!onSetBalance &&
        asset.market?.code === "PRIVATE" &&
        isConstantPrice(asset)) ||
      (!!onSectorWeightings && asset.assetCategory?.id === "ETF") ||
      (asset.assetCategory?.id === "RE" &&
        (!!onRecordIncome || !!onRecordExpense)) ||
      !!onEditAsset ||
      !!onGoToPortfolio)

  const hasCashActions =
    supportsBalanceSetting(asset) &&
    (!!onSetCashBalance ||
      !!onCashTransfer ||
      !!onCashTransaction ||
      !!onRecordIncome ||
      !!onRecordExpense ||
      !!onGoToPortfolio ||
      (!!onEditAsset && asset.market?.code === "PRIVATE"))

  const tradeMoney = moneyValues["TRADE"]
  const tradeCurrency = tradeMoney?.currency || portfolio.currency

  const actionsNode =
    hasActions || hasCashActions ? (
      <div className="flex items-center gap-1">
        {hasActions && (
          <ActionsMenu
            asset={asset}
            portfolioId={portfolio.id}
            portfolioCode={portfolio.code}
            fromDate={dateValues?.opened}
            closedDate={dateValues?.closed}
            quantity={quantityValues.total}
            price={values.priceData?.close || 0}
            costBasis={tradeMoney?.costBasis || 0}
            tradeCurrency={tradeCurrency}
            valueIn={valueIn}
            onTrade={isCashRelated(asset) ? undefined : onTrade}
            onQuickSell={isCashRelated(asset) ? undefined : onQuickSell}
            onCorporateActions={
              isCashRelated(asset) ? undefined : onCorporateActions
            }
            onSetPrice={onSetPrice}
            onSetBalance={onSetBalance}
            onSectorWeightings={onSectorWeightings}
            onCostAdjust={isCashRelated(asset) ? undefined : onCostAdjust}
            onMovePosition={isCashRelated(asset) ? undefined : onMovePosition}
            onRecordIncome={onRecordIncome}
            onRecordExpense={onRecordExpense}
            onEditAsset={onEditAsset}
            onGoToPortfolio={onGoToPortfolio}
          />
        )}
        {hasCashActions && (
          <CashActionsMenu
            asset={asset}
            portfolio={portfolio}
            marketValue={tradeMoney?.marketValue || 0}
            tradeCurrency={tradeCurrency}
            onRecordIncome={onRecordIncome}
            onRecordExpense={onRecordExpense}
            onEditAsset={onEditAsset}
            onGoToPortfolio={onGoToPortfolio}
            onSetCashBalance={onSetCashBalance}
            onCashTransfer={onCashTransfer}
            onCashTransaction={onCashTransaction}
          />
        )}
      </div>
    ) : undefined

  const handleDoubleClick = useCallback(() => {
    router.push(supportsBalanceSetting(asset) ? cashLadderHref : tradesHref)
  }, [router, asset, cashLadderHref, tradesHref])

  return (
    <div
      id={`asset-${asset.id}`}
      className={`${CARD_CLASSNAME} cursor-pointer`}
      onDoubleClick={handleDoubleClick}
      title="Double-click to open"
    >
      {popup}
      <PositionHeader
        asset={asset}
        displayName={displayName}
        hasDistinctName={hasDistinctName}
        truncatedName={truncatedName}
        changePercent={values.priceData?.changePercent}
        onShowNews={() => showNews(asset)}
        actionsMenu={actionsNode}
      />

      <div className="mb-3">
        <div className="text-2xl font-bold text-gray-900">
          {currencySymbol}
          <FormatValue value={marketValue} />
        </div>
        <div className="text-sm text-gray-500">Current Value</div>
      </div>

      <PositionPnL
        asset={asset}
        totalGain={totalGain}
        isPositive={isPositive}
        irr={values.irr}
        currencySymbol={currencySymbol}
      />

      {!isCashRelated(asset) &&
        (() => {
          const isChartable =
            !!onPriceChart &&
            !!values.priceData?.close &&
            isChartableCategory(asset.assetCategory?.id)
          const handlePriceClick = isChartable
            ? (e: React.MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                onPriceChart!({
                  asset,
                  currencySymbol: values.currency.symbol,
                  portfolioId: portfolio.id,
                })
              }
            : undefined
          const isBreakdownable =
            !!onPortfolioBreakdown &&
            !!portfolioBreakdown &&
            portfolioBreakdown.length > 0
          const handleQuantityClick = isBreakdownable
            ? (e: React.MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                onPortfolioBreakdown!({
                  asset,
                  breakdown: portfolioBreakdown!,
                })
              }
            : undefined
          return (
            <>
              <PositionFooter
                quantity={quantityValues.total}
                precision={quantityValues.precision}
                price={values.priceData?.close}
                priceDate={values.priceData?.priceDate}
                weight={values.weight}
                currencySymbol={currencySymbol}
                onPriceClick={handlePriceClick}
                priceAriaLabel={
                  isChartable
                    ? `Show price chart for ${stripOwnerPrefix(asset.code)}`
                    : undefined
                }
                onQuantityClick={handleQuantityClick}
                quantityAriaLabel={
                  isBreakdownable
                    ? `Show portfolios holding ${stripOwnerPrefix(asset.code)}`
                    : undefined
                }
              />
              {/* Alpha bar — holding period + time-weighted alpha, shared with
                  the table view. Tooltip explains the figure on hover. */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <AlphaProgress
                  irr={values.irr}
                  lastTradeDate={dateValues?.opened || undefined}
                />
              </div>
            </>
          )
        })()}
    </div>
  )
}

// Helper to sort positions within a group
const sortPositionsWithinGroup = (
  positions: Position[],
  valueIn: string,
): Position[] => {
  return [...positions].sort((a, b) => {
    const aIsCash = isNonTradeable(a.asset)
    const bIsCash = isNonTradeable(b.asset)

    // Cash positions go to the end
    if (aIsCash && !bIsCash) return 1
    if (!aIsCash && bIsCash) return -1

    // Otherwise sort by market value descending
    const aValue = a.moneyValues[valueIn]?.marketValue || 0
    const bValue = b.moneyValues[valueIn]?.marketValue || 0
    return bValue - aValue
  })
}

interface GroupedPositions {
  groupKey: string
  positions: Position[]
}

const CardView: React.FC<CardViewProps> = ({
  holdings,
  portfolio,
  valueIn,
  groupBy,
  isMixedCurrencies = false,
  targetAssetId,
  onTrade,
  onQuickSell,
  onCorporateActions,
  onSetPrice,
  onSetBalance,
  onSectorWeightings,
  onCostAdjust,
  onMovePosition,
  onRecordIncome,
  onRecordExpense,
  onSetCashBalance,
  onCashTransfer,
  onCashTransaction,
  onPriceChart,
  onPortfolioBreakdown,
  onEditAsset,
  onGoToPortfolio,
}) => {
  // Group positions by holdingGroups, sorted by group comparator
  const groupedPositions = useMemo((): GroupedPositions[] => {
    return Object.keys(holdings.holdingGroups)
      .sort(getGroupComparator(groupBy ?? ""))
      .map((groupKey) => ({
        groupKey,
        positions: sortPositionsWithinGroup(
          holdings.holdingGroups[groupKey].positions,
          valueIn,
        ),
      }))
  }, [holdings, valueIn, groupBy])

  // Flatten for total count
  const totalPositionCount = useMemo(() => {
    return groupedPositions.reduce(
      (sum, group) => sum + group.positions.length,
      0,
    )
  }, [groupedPositions])

  // Track which groups the user has expanded. Default: everything collapsed.
  // The expanded set is persisted to localStorage (keyed by groupBy) so the
  // choice survives navigation between portfolios and page reloads. Groups the
  // user has never opened stay collapsed. The deep-link target group is
  // force-expanded so anchored scrolls land on a visible card.
  // Parent passes `key={groupBy}` so this component remounts (and the lazy
  // initializer below re-runs) whenever groupBy changes — the stored set is
  // keyed by groupBy to match. CardView renders client-side after the holdings
  // fetch, so reading localStorage in the initializer is hydration-safe.
  const expandedStorageKey = `bc:holdings:expandedGroups:${groupBy ?? ""}`

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const next = new Set<string>()
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(expandedStorageKey)
        if (raw) {
          for (const key of JSON.parse(raw) as string[]) next.add(key)
        }
      } catch {
        // Corrupt/blocked storage — fall back to all-collapsed.
      }
    }
    // Force-expand the deep-link target group so anchored scrolls land on a
    // visible card.
    if (targetAssetId) {
      const targetGroupKey = groupedPositions.find((g) =>
        g.positions.some((p) => p.asset.id === targetAssetId),
      )?.groupKey
      if (targetGroupKey) next.add(targetGroupKey)
    }
    return next
  })

  const toggleGroup = useCallback(
    (groupKey: string) => {
      setExpandedGroups((prev) => {
        const next = new Set(prev)
        if (next.has(groupKey)) {
          next.delete(groupKey)
        } else {
          next.add(groupKey)
        }
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              expandedStorageKey,
              JSON.stringify([...next]),
            )
          } catch {
            // Ignore storage write failures (private mode / quota).
          }
        }
        return next
      })
    },
    [expandedStorageKey],
  )

  // Source currency based on valueIn selection
  // For TRADE with mixed currencies, use BASE for header totals
  const sourceCurrency: Currency | undefined = useMemo(() => {
    if (valueIn === "PORTFOLIO") return portfolio.currency
    if (valueIn === "BASE") return portfolio.base
    // TRADE mode: use BASE if mixed currencies, otherwise use first position's trade currency
    if (isMixedCurrencies) return portfolio.base
    const firstPosition = groupedPositions[0]?.positions[0]
    return firstPosition?.moneyValues?.TRADE?.currency || portfolio.currency
  }, [valueIn, portfolio, groupedPositions, isMixedCurrencies])

  const { convert, currencySymbol } = useDisplayCurrencyConversion({
    sourceCurrency,
    portfolio,
  })

  // Calculate totals for summary
  // When in TRADE mode with mixed currencies, sum BASE values instead
  const totals = useMemo(() => {
    const useBase = valueIn === "TRADE" && isMixedCurrencies
    const bucket = useBase ? "BASE" : valueIn

    // Sum from group subTotals to get the correct bucket values
    let marketValue = 0
    let totalGain = 0
    let gainOnDay = 0
    Object.values(holdings.holdingGroups).forEach((group) => {
      const subTotal = group.subTotals?.[bucket]
      if (subTotal) {
        marketValue += subTotal.marketValue || 0
        totalGain += subTotal.totalGain || 0
        gainOnDay += subTotal.gainOnDay || 0
      }
    })

    return {
      marketValue: convert(marketValue),
      totalGain: convert(totalGain),
      gainOnDay: convert(gainOnDay),
    }
  }, [holdings, convert, valueIn, isMixedCurrencies])

  const isPositive = totals.totalGain >= 0
  const isDayPositive = totals.gainOnDay >= 0
  const overallIrr = holdings.totals.irr
  const isIrrPositive = overallIrr >= 0
  const currencyCode = sourceCurrency?.code || "USD"

  return (
    <div className="space-y-4">
      {/* Portfolio Summary Card - always at top */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl px-4 py-2.5 text-white">
        <div className="flex items-center gap-3 flex-wrap gap-y-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <div className="text-xl font-bold whitespace-nowrap">
              {currencySymbol}
              <span className="sm:hidden">
                <FormatValue value={totals.marketValue} scale={0} />
              </span>
              <span className="hidden sm:inline">
                <FormatValue value={totals.marketValue} />
              </span>
            </div>
            <div className="text-xs opacity-75 whitespace-nowrap">
              {currencyCode} · {totalPositionCount} holding
              {totalPositionCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            <span
              className={`text-sm font-semibold whitespace-nowrap ${
                isPositive ? "text-green-200" : "text-red-200"
              }`}
              title="Total profit"
            >
              {isPositive && totals.totalGain > 0 ? "+" : ""}
              {currencySymbol}
              <FormatValue value={totals.totalGain} />
            </span>
            <span
              className={`text-sm font-semibold whitespace-nowrap ${
                isIrrPositive ? "text-green-200" : "text-red-200"
              }`}
              title="Growth"
            >
              {isIrrPositive ? "+" : ""}
              {(overallIrr * 100).toFixed(1)}%
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                isDayPositive
                  ? "bg-green-500/20 text-green-100"
                  : "bg-red-500/20 text-red-100"
              }`}
              title="Today's change"
            >
              {isDayPositive ? "+" : ""}
              {currencySymbol}
              <FormatValue value={totals.gainOnDay} />
            </span>
          </div>
        </div>
      </div>

      {/* Grouped Position Cards */}
      {groupedPositions.map((group) => {
        const isCollapsed = !expandedGroups.has(group.groupKey)
        const groupSubTotals = holdings.holdingGroups[group.groupKey]?.subTotals
        const groupMarketValue = groupSubTotals
          ? convert(groupSubTotals[valueIn]?.marketValue || 0)
          : 0
        const groupGainOnDay = groupSubTotals
          ? convert(groupSubTotals[valueIn]?.gainOnDay || 0)
          : 0
        const groupWeight = groupSubTotals?.[valueIn]?.weight
        const isGroupDayPositive = groupGainOnDay >= 0
        return (
          <div key={group.groupKey} className="space-y-3">
            {/* Group Header - clickable to toggle */}
            <button
              onClick={() => toggleGroup(group.groupKey)}
              className="flex items-center gap-2 px-2 w-full text-left hover:bg-gray-50 rounded-lg py-2 -my-1 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${
                  isCollapsed ? "" : "rotate-90"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <h3 className="text-sm font-semibold text-gray-700 truncate min-w-0">
                {group.groupKey}
              </h3>
              <span className="text-xs text-gray-400 shrink-0">
                ({group.positions.length})
              </span>
              <span className="ml-auto flex items-center gap-3 shrink-0">
                <span className="w-14 text-right text-xs font-medium text-gray-500 tabular-nums">
                  {groupWeight !== undefined && (
                    <>
                      <FormatValue
                        value={groupWeight}
                        multiplier={100}
                        isPublic
                      />
                      %
                    </>
                  )}
                </span>
                <span className="w-24 text-right text-sm font-medium text-gray-900 tabular-nums">
                  {currencySymbol}
                  <FormatValue value={groupMarketValue} />
                </span>
                <span
                  className={`w-24 text-right text-xs font-medium tabular-nums ${
                    isGroupDayPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isGroupDayPositive ? "+" : ""}
                  {currencySymbol}
                  <FormatValue value={groupGainOnDay} />
                </span>
              </span>
            </button>

            {/* Cards Grid - collapsible */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.positions.map((position, index) => (
                  <PositionCard
                    key={`${position.asset.id}-${index}`}
                    position={position}
                    portfolio={portfolio}
                    valueIn={valueIn}
                    sourceCurrency={sourceCurrency}
                    onTrade={onTrade}
                    onQuickSell={onQuickSell}
                    onCorporateActions={onCorporateActions}
                    onSetPrice={onSetPrice}
                    onSetBalance={onSetBalance}
                    onSectorWeightings={onSectorWeightings}
                    onCostAdjust={onCostAdjust}
                    onMovePosition={onMovePosition}
                    onRecordIncome={onRecordIncome}
                    onRecordExpense={onRecordExpense}
                    onSetCashBalance={onSetCashBalance}
                    onCashTransfer={onCashTransfer}
                    onCashTransaction={onCashTransaction}
                    onPriceChart={onPriceChart}
                    onPortfolioBreakdown={onPortfolioBreakdown}
                    onEditAsset={onEditAsset}
                    onGoToPortfolio={onGoToPortfolio}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default CardView
