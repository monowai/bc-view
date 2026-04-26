import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  CashTransferData,
  CostAdjustData,
  Currency,
  Holdings,
  MovePositionData,
  Portfolio,
  Position,
  QuickSellData,
  SetBalanceData,
  SetCashBalanceData,
  SetPriceData,
} from "types/beancounter"
import { FormatValue, PrivateQuantity } from "@components/ui/MoneyUtils"
import {
  buildTradesHref,
  getPositionDisplayName,
  isCashRelated,
  isConstantPrice,
  isNonTradeable,
  stripOwnerPrefix,
  supportsBalanceSetting,
} from "@lib/assets/assetUtils"
import { useDisplayCurrencyConversion } from "@lib/hooks/useDisplayCurrencyConversion"
import { compareByReportCategory, compareBySector } from "@lib/categoryMapping"
import { GroupBy } from "@components/features/holdings/GroupByOptions"
import { useRouter } from "next/router"
import AssetNewsButton from "@components/features/holdings/AssetNewsButton"
import { useNewsAsset } from "@components/features/holdings/useNewsAsset"
import { PriceChartData } from "@components/features/holdings/Rows"
import {
  ActionsMenu,
  CashActionsMenu,
  CorporateActionsData,
  SectorWeightingsData,
} from "@components/features/holdings/ActionsMenus"

interface SharedActionHandlers {
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
  onCashTransaction?: (assetCode: string) => void
  onPriceChart?: (data: PriceChartData) => void
}

interface CardViewProps extends SharedActionHandlers {
  holdings: Holdings
  portfolio: Portfolio
  valueIn: string
  groupBy?: string
  isMixedCurrencies?: boolean
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
  weight: number
  currencySymbol: string
  onPriceClick?: (e: React.MouseEvent) => void
  priceAriaLabel?: string
}

const PositionFooter: React.FC<PositionFooterProps> = ({
  quantity,
  precision,
  price,
  weight,
  currencySymbol,
  onPriceClick,
  priceAriaLabel,
}) => {
  const priceText = (
    <>
      {currencySymbol}
      {price?.toFixed(2) || "-"}
    </>
  )
  const priceValue = onPriceClick ? (
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
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-sm">
      <PositionMetric
        label="Quantity"
        value={<PrivateQuantity value={quantity} precision={precision} />}
      />
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
}) => {
  const router = useRouter()
  const { popup, showNews } = useNewsAsset()
  const { asset, moneyValues, quantityValues, dateValues } = position
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

  const tradesHref = buildTradesHref(portfolio.id, asset.id)
  const cashLadderHref = `/trns/cash-ladder/${portfolio.id}/${asset.id}`

  const hasActions =
    (!isCashRelated(asset) &&
      (!!onQuickSell ||
        !!onCorporateActions ||
        !!onCostAdjust ||
        !!onMovePosition ||
        !!onRecordIncome ||
        !!onRecordExpense ||
        (!!onSetPrice && asset.market?.code === "PRIVATE") ||
        (!!onSetBalance &&
          asset.market?.code === "PRIVATE" &&
          isConstantPrice(asset)) ||
        (!!onSectorWeightings && asset.assetCategory?.id === "ETF"))) ||
    (asset.assetCategory?.id === "RE" &&
      (!!onRecordIncome || !!onRecordExpense))

  const hasCashActions =
    supportsBalanceSetting(asset) &&
    (!!onSetCashBalance || !!onCashTransfer || !!onCashTransaction)

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
          />
        )}
        {hasCashActions && (
          <CashActionsMenu
            asset={asset}
            portfolio={portfolio}
            marketValue={tradeMoney?.marketValue || 0}
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
          const categoryId = asset.assetCategory?.id
          const isChartable =
            !!onPriceChart &&
            !!values.priceData?.close &&
            (categoryId === "EQUITY" || categoryId === "ETF")
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
          return (
            <PositionFooter
              quantity={quantityValues.total}
              precision={quantityValues.precision}
              price={values.priceData?.close}
              weight={values.weight}
              currencySymbol={currencySymbol}
              onPriceClick={handlePriceClick}
              priceAriaLabel={
                isChartable
                  ? `Show price chart for ${stripOwnerPrefix(asset.code)}`
                  : undefined
              }
            />
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
}) => {
  // Group positions by holdingGroups, sorted by group comparator
  const groupedPositions = useMemo((): GroupedPositions[] => {
    const sorter =
      groupBy === GroupBy.SECTOR ? compareBySector : compareByReportCategory

    return Object.keys(holdings.holdingGroups)
      .sort(sorter)
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

  // Track collapsed groups - start with first group expanded
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(groupedPositions.slice(1).map((g) => g.groupKey)),
  )

  // Collapse all except first group when groupBy changes
  useEffect(() => {
    setCollapsedGroups(
      new Set(groupedPositions.slice(1).map((g) => g.groupKey)),
    )
  }, [groupBy]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-5 text-white">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-sm opacity-90">
              Total Value ({currencyCode})
            </div>
            <div className="text-3xl font-bold">
              {currencySymbol}
              <FormatValue value={totals.marketValue} />
            </div>
          </div>
          <div
            className={`text-right px-3 py-1 rounded-full text-sm font-medium ${
              isDayPositive
                ? "bg-green-500/20 text-green-100"
                : "bg-red-500/20 text-red-100"
            }`}
          >
            {isDayPositive ? "+" : ""}
            {currencySymbol}
            <FormatValue value={totals.gainOnDay} /> today
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-semibold ${
                isPositive ? "text-green-200" : "text-red-200"
              }`}
            >
              {isPositive && totals.totalGain > 0 ? "+" : ""}
              {currencySymbol}
              <FormatValue value={totals.totalGain} />
            </span>
            <span className="text-sm opacity-75">total profit</span>
          </div>
          <div className="text-right">
            <span
              className={`text-lg font-semibold ${
                isIrrPositive ? "text-green-200" : "text-red-200"
              }`}
            >
              {isIrrPositive ? "+" : ""}
              {(overallIrr * 100).toFixed(1)}%
            </span>
            <span className="text-sm opacity-75 ml-1">growth</span>
          </div>
        </div>
      </div>

      {/* Position count */}
      <div className="text-sm text-gray-500 px-1">
        {totalPositionCount} holding{totalPositionCount !== 1 ? "s" : ""}
      </div>

      {/* Grouped Position Cards */}
      {groupedPositions.map((group) => {
        const isCollapsed = collapsedGroups.has(group.groupKey)
        const groupSubTotals = holdings.holdingGroups[group.groupKey]?.subTotals
        const groupMarketValue = groupSubTotals
          ? convert(groupSubTotals[valueIn]?.marketValue || 0)
          : 0
        const groupGainOnDay = groupSubTotals
          ? convert(groupSubTotals[valueIn]?.gainOnDay || 0)
          : 0
        const isGroupDayPositive = groupGainOnDay >= 0
        return (
          <div key={group.groupKey} className="space-y-3">
            {/* Group Header - clickable to toggle */}
            <button
              onClick={() => toggleGroup(group.groupKey)}
              className="flex items-center gap-2 px-2 w-full text-left hover:bg-gray-50 rounded-lg py-2 -my-1 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${
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
              <h3 className="text-sm font-semibold text-gray-700">
                {group.groupKey}
              </h3>
              <span className="text-xs text-gray-400">
                ({group.positions.length})
              </span>
              <span className="ml-auto flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {currencySymbol}
                  <FormatValue value={groupMarketValue} />
                </span>
                <span
                  className={`text-xs font-medium ${
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
