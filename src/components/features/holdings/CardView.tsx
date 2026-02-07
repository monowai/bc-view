import React, { useMemo, useState, useCallback, useEffect } from "react"
import { Holdings, Portfolio, Position, Currency } from "types/beancounter"
import { FormatValue, PrivateQuantity } from "@components/ui/MoneyUtils"
import { isCash, isCashRelated } from "@lib/assets/assetUtils"
import { useDisplayCurrencyConversion } from "@lib/hooks/useDisplayCurrencyConversion"
import { compareByReportCategory, compareBySector } from "@lib/categoryMapping"
import { GroupBy } from "@components/features/holdings/GroupByOptions"
import Link from "next/link"

interface CardViewProps {
  holdings: Holdings
  portfolio: Portfolio
  valueIn: string
  groupBy?: string
  isMixedCurrencies?: boolean
}

interface PositionCardProps {
  position: Position
  portfolio: Portfolio
  valueIn: string
  sourceCurrency: Currency | undefined
}

const PositionCard: React.FC<PositionCardProps> = ({
  position,
  portfolio,
  valueIn,
  sourceCurrency,
}) => {
  const { asset, moneyValues, quantityValues } = position
  const values = moneyValues[valueIn]

  // For TRADE view, use the position's own trade currency, not the passed sourceCurrency
  const positionCurrency =
    valueIn === "TRADE" ? moneyValues.TRADE?.currency : sourceCurrency

  const { convert, currencySymbol } = useDisplayCurrencyConversion({
    sourceCurrency: positionCurrency,
    portfolio,
  })

  const marketValue = convert(values.marketValue)
  const totalGain = convert(values.totalGain)
  const gainOnDay = convert(values.gainOnDay)
  const isPositive = totalGain >= 0
  const isDayPositive = gainOnDay >= 0

  // Simple display name - show code for stocks, name for cash
  const displayName = isCash(asset)
    ? asset.name
    : asset.code.indexOf(".") > 0
      ? asset.code.substring(asset.code.indexOf(".") + 1)
      : asset.code

  // Truncate long names
  const truncatedName =
    asset.name.length > 30 ? asset.name.substring(0, 30) + "..." : asset.name

  return (
    <Link
      href={`/trns/trades/${portfolio.id}/${asset.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      {/* Header: Asset code and today's change */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg">{displayName}</h3>
          {!isCash(asset) && (
            <p className="text-sm text-gray-500 truncate">{truncatedName}</p>
          )}
        </div>
        {values.priceData?.changePercent !== undefined && (
          <div
            className={`text-right ${isDayPositive ? "text-green-600" : "text-red-600"}`}
          >
            <div className="text-sm font-medium">
              {isDayPositive ? "+" : ""}
              {(values.priceData.changePercent * 100).toFixed(2)}%
            </div>
            <div className="text-xs">today</div>
          </div>
        )}
      </div>

      {/* Main value */}
      <div className="mb-3">
        <div className="text-2xl font-bold text-gray-900">
          {currencySymbol}
          <FormatValue value={marketValue} />
        </div>
        <div className="text-sm text-gray-500">Current Value</div>
      </div>

      {/* Profit/Loss section */}
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

        {/* Growth rate - simple language */}
        {!isCashRelated(asset) && (
          <div className="text-right">
            <div
              className={`text-lg font-semibold ${values.irr >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {values.irr >= 0 ? "+" : ""}
              {(values.irr * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">Growth</div>
          </div>
        )}
      </div>

      {/* Quantity for non-cash assets */}
      {!isCashRelated(asset) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm text-gray-500">
          <span>
            <PrivateQuantity
              value={quantityValues.total}
              precision={quantityValues.precision}
            />{" "}
            shares
          </span>
          <span>
            {currencySymbol}
            {values.priceData?.close?.toFixed(2) || "-"} each
          </span>
        </div>
      )}
    </Link>
  )
}

// Helper to sort positions within a group
const sortPositionsWithinGroup = (
  positions: Position[],
  valueIn: string,
): Position[] => {
  return [...positions].sort((a, b) => {
    const aIsCash = isCashRelated(a.asset)
    const bIsCash = isCashRelated(b.asset)

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

  // Track collapsed groups - start all collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(groupedPositions.map((g) => g.groupKey)),
  )

  // Collapse all groups when groupBy changes
  useEffect(() => {
    setCollapsedGroups(new Set(groupedPositions.map((g) => g.groupKey)))
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
