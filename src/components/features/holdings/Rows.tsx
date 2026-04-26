import React, { useEffect, useMemo } from "react"
import {
  HoldingValues,
  PriceData,
  QuickSellData,
  WeightClickData,
  SetCashBalanceData,
  SetPriceData,
  SetBalanceData,
  CashTransferData,
  CostAdjustData,
  MovePositionData,
  Asset,
} from "types/beancounter"
import {
  FormatValue,
  ResponsiveFormatValue,
  PrivateQuantity,
} from "@components/ui/MoneyUtils"
import {
  buildTradesHref,
  getPositionDisplayName,
  isCash,
  isCashRelated,
  isConstantPrice,
  supportsBalanceSetting,
  stripOwnerPrefix,
} from "@lib/assets/assetUtils"
import Link from "next/link"
import { useRouter } from "next/router"
import AssetNewsButton from "./AssetNewsButton"
import { useNewsAsset } from "./useNewsAsset"
import { AlphaProgress } from "@components/ui/ProgressBar"
import { useDisplayCurrencyConversion } from "@lib/hooks/useDisplayCurrencyConversion"
import { getCellClasses } from "@lib/holdings/cellClasses"
import {
  ActionsMenu,
  CashActionsMenu,
  CorporateActionsData,
  SectorWeightingsData,
} from "./ActionsMenus"

export type { CorporateActionsData, SectorWeightingsData }

export interface PriceChartData {
  asset: Asset
  currencySymbol: string
  portfolioId: string
}

interface RowsProps extends HoldingValues {
  onColumnsChange: (columns: string[]) => void
  onQuickSell?: (data: QuickSellData) => void
  onCorporateActions?: (data: CorporateActionsData) => void
  onWeightClick?: (data: WeightClickData) => void
  onSetCashBalance?: (data: SetCashBalanceData) => void
  onSetPrice?: (data: SetPriceData) => void
  onSetBalance?: (data: SetBalanceData) => void
  onSectorWeightings?: (data: SectorWeightingsData) => void
  onCashTransfer?: (data: CashTransferData) => void
  onCashTransaction?: (assetCode: string) => void
  onCostAdjust?: (data: CostAdjustData) => void
  onMovePosition?: (data: MovePositionData) => void
  onRecordIncome?: (data: QuickSellData) => void
  onRecordExpense?: (data: QuickSellData) => void
  onPriceChart?: (data: PriceChartData) => void
}

// Helper function to truncate text with ellipsis
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

export default function Rows({
  portfolio,
  holdingGroup,
  groupBy,
  valueIn,
  onColumnsChange,
  onQuickSell,
  onCorporateActions,
  onWeightClick,
  onSetCashBalance,
  onSetPrice,
  onSetBalance,
  onSectorWeightings,
  onCashTransfer,
  onCashTransaction,
  onCostAdjust,
  onMovePosition,
  onRecordIncome,
  onRecordExpense,
  onPriceChart,
}: RowsProps): React.ReactElement {
  const router = useRouter()
  const { popup: newsPopup, showNews } = useNewsAsset()

  // Source currency based on valueIn selection
  const sourceCurrency = useMemo(() => {
    if (valueIn === "PORTFOLIO") return portfolio.currency
    if (valueIn === "BASE") return portfolio.base
    // For TRADE, use the first position's currency as representative
    return (
      holdingGroup.positions[0]?.moneyValues?.TRADE?.currency ||
      portfolio.currency
    )
  }, [valueIn, portfolio, holdingGroup])

  // Use shared hook for display currency conversion
  const { convert, currencySymbol: effectiveCurrencySymbol } =
    useDisplayCurrencyConversion({
      sourceCurrency,
      portfolio,
    })

  const columns = useMemo(
    () => [
      "Asset Code",
      "Asset Name",
      "Classification",
      "Price",
      "Change %",
      "Change on Day",
      "Quantity",
      "Cost Value",
      "Market Value",
      "Unrealised Gain",
      "Realised Gain",
      "Dividends",
      "IRR",
      "Alpha",
      "Weight",
      "Total Gain",
    ],
    [],
  )

  useEffect(() => {
    onColumnsChange(columns)
  }, [columns, onColumnsChange])

  const hideValue = (priceData: PriceData | undefined): boolean => !priceData

  return (
    <tbody>
      {holdingGroup.positions.map(
        ({ asset, moneyValues, quantityValues, dateValues, held }, index) => (
          <tr
            key={`${groupBy}-${valueIn}-${index}`}
            className={`holding-row text-sm cursor-pointer border-l-2 border-l-transparent ${
              index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
            }`}
            onDoubleClick={() =>
              supportsBalanceSetting(asset)
                ? router.push(`/trns/cash-ladder/${portfolio.id}/${asset.id}`)
                : router.push(buildTradesHref(portfolio.id, asset.id))
            }
            title={"Double-click to open"}
          >
            <td className="px-1 py-1.5 sm:px-2 md:px-3 text-ellipsis min-w-0">
              {/* Unified layout: code on top, name below for both mobile and desktop */}
              <div className="flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm sm:text-base text-slate-900 flex items-center gap-1"
                    title={stripOwnerPrefix(asset.code)}
                  >
                    {getPositionDisplayName(asset)}
                    <AssetNewsButton
                      asset={asset}
                      onShow={() => showNews(asset)}
                      iconClassName="text-[10px]"
                    />
                  </div>
                  {!isCash(asset) && asset.name && (
                    <div
                      className="text-[10px] xl:text-xs text-slate-500 truncate max-w-[100px] sm:max-w-[180px] xl:max-w-none"
                      title={asset.name}
                    >
                      {truncateText(asset.name, 18)}
                    </div>
                  )}
                </div>
                {(!isCashRelated(asset) &&
                  (onQuickSell ||
                    onCorporateActions ||
                    onCostAdjust ||
                    onRecordIncome ||
                    onRecordExpense ||
                    (onSetPrice && asset.market?.code === "PRIVATE") ||
                    (onSetBalance &&
                      asset.market?.code === "PRIVATE" &&
                      isConstantPrice(asset)))) ||
                (asset.assetCategory?.id === "RE" &&
                  (onRecordIncome || onRecordExpense)) ? (
                  <div className="flex items-center">
                    <ActionsMenu
                      asset={asset}
                      portfolioId={portfolio.id}
                      portfolioCode={portfolio.code}
                      fromDate={dateValues?.opened}
                      closedDate={dateValues?.closed}
                      quantity={quantityValues.total}
                      price={moneyValues[valueIn].priceData?.close || 0}
                      costBasis={moneyValues["TRADE"]?.costBasis || 0}
                      tradeCurrency={
                        moneyValues["TRADE"]?.currency || portfolio.currency
                      }
                      valueIn={valueIn}
                      held={held}
                      onQuickSell={
                        isCashRelated(asset) ? undefined : onQuickSell
                      }
                      onCorporateActions={
                        isCashRelated(asset) ? undefined : onCorporateActions
                      }
                      onSetPrice={onSetPrice}
                      onSetBalance={onSetBalance}
                      onSectorWeightings={onSectorWeightings}
                      onCostAdjust={
                        isCashRelated(asset) ? undefined : onCostAdjust
                      }
                      onMovePosition={
                        isCashRelated(asset) ? undefined : onMovePosition
                      }
                      onRecordIncome={onRecordIncome}
                      onRecordExpense={onRecordExpense}
                    />
                  </div>
                ) : null}
                {supportsBalanceSetting(asset) &&
                  (onSetCashBalance || onCashTransfer || onCashTransaction) && (
                    <div className="flex items-center">
                      <CashActionsMenu
                        asset={asset}
                        portfolio={portfolio}
                        marketValue={moneyValues["TRADE"].marketValue}
                        onSetCashBalance={onSetCashBalance}
                        onCashTransfer={onCashTransfer}
                        onCashTransaction={onCashTransaction}
                      />
                    </div>
                  )}
              </div>
            </td>
            <td className={getCellClasses(0)}>
              {hideValue(moneyValues[valueIn].priceData) ||
              !moneyValues[valueIn].priceData?.close
                ? " "
                : (() => {
                    const categoryId = asset.assetCategory?.id
                    const isChartable =
                      !!onPriceChart &&
                      (categoryId === "EQUITY" || categoryId === "ETF")
                    const priceContent = (
                      <>
                        <span className="text-xs text-slate-500">
                          {moneyValues[valueIn].currency.symbol}
                        </span>
                        <FormatValue
                          value={moneyValues[valueIn].priceData.close}
                          isPublic
                        />
                        <span className="absolute right-0 transform -translate-y-full mb-1 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                          {moneyValues[valueIn].priceData.priceDate}
                        </span>
                      </>
                    )
                    return isChartable ? (
                      <button
                        type="button"
                        aria-label={`Show price chart for ${stripOwnerPrefix(asset.code)}`}
                        className="relative group text-left cursor-pointer hover:text-wealth-700 hover:underline underline-offset-2 decoration-dotted"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPriceChart({
                            asset,
                            currencySymbol:
                              moneyValues[valueIn].currency.symbol,
                            portfolioId: portfolio.id,
                          })
                        }}
                      >
                        {priceContent}
                      </button>
                    ) : (
                      <span className="relative group">{priceContent}</span>
                    )
                  })()}
            </td>
            <td className={getCellClasses(1)}>
              {hideValue(moneyValues[valueIn].priceData?.changePercent) ? (
                " "
              ) : (
                <span
                  className={`relative group tabular-nums ${
                    moneyValues[valueIn].priceData.changePercent < 0
                      ? "text-red-600"
                      : moneyValues[valueIn].priceData.changePercent > 0
                        ? "text-emerald-600"
                        : "text-slate-600"
                  }`}
                >
                  <FormatValue
                    value={Math.abs(
                      moneyValues[valueIn].priceData.changePercent,
                    )}
                    multiplier={100}
                    isPublic
                  />
                  {"%"}
                  <span className="absolute right-0 transform -translate-y-full mb-1 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    Change: {effectiveCurrencySymbol}
                    {convert(moneyValues[valueIn].gainOnDay)?.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    ) || "0.00"}
                  </span>
                </span>
              )}
            </td>
            <td className={getCellClasses(2)}>
              {hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : (
                <ResponsiveFormatValue
                  value={convert(moneyValues[valueIn].gainOnDay)}
                />
              )}
            </td>

            <td className={getCellClasses(3)}>
              {isCashRelated(asset) ||
              hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : held && Object.keys(held).length > 1 ? (
                <span className="relative group cursor-help">
                  <PrivateQuantity
                    value={quantityValues.total}
                    precision={quantityValues.precision}
                  />
                  <span className="absolute right-0 transform -translate-y-full mb-1 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {Object.entries(held).map(([broker, qty]) => (
                      <div key={broker}>
                        {broker}: {qty.toLocaleString()}
                      </div>
                    ))}
                  </span>
                </span>
              ) : (
                <PrivateQuantity
                  value={quantityValues.total}
                  precision={quantityValues.precision}
                />
              )}
            </td>
            <td className={getCellClasses(4)}>
              <span className="relative group">
                <ResponsiveFormatValue
                  value={convert(moneyValues[valueIn].costValue)}
                />
                <span className="absolute right-0 transform -translate-y-full mb-1 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Average:{" "}
                  {convert(moneyValues[valueIn].averageCost).toLocaleString()}
                </span>
              </span>
            </td>
            <td className={getCellClasses(5)}>
              <ResponsiveFormatValue
                value={convert(moneyValues[valueIn].marketValue)}
                defaultValue="0"
              />
            </td>
            <td className={getCellClasses(6)}>
              {!isCashRelated(asset) && (
                <span
                  className={`relative group tabular-nums ${
                    moneyValues[valueIn].irr < 0
                      ? "text-red-600"
                      : moneyValues[valueIn].irr > 0
                        ? "text-emerald-600"
                        : "text-slate-600"
                  }`}
                >
                  <FormatValue
                    value={Math.abs(moneyValues[valueIn].irr)}
                    multiplier={100}
                    isPublic
                  />
                  {"%"}
                  <span className="absolute right-0 transform -translate-y-full mb-1 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    ROI: {(Math.abs(moneyValues[valueIn].roi) * 100).toFixed(2)}
                    %
                  </span>
                </span>
              )}
            </td>
            <td className={getCellClasses(7)}>
              <span className="relative group">
                <Link
                  href={`/trns/events`}
                  as={`/trns/events/${portfolio.id}/${asset.id}`}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ResponsiveFormatValue
                    value={convert(moneyValues[valueIn].dividends)}
                  />
                </Link>
                <span className="absolute right-0 transform -translate-y-full mb-1 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  Last Event: {dateValues?.lastDividend || "N/A"}
                </span>
              </span>
            </td>
            <td className={getCellClasses(8)}>
              <ResponsiveFormatValue
                value={convert(moneyValues[valueIn].unrealisedGain)}
              />
            </td>
            <td className={getCellClasses(9)}>
              <ResponsiveFormatValue
                value={convert(moneyValues[valueIn].realisedGain)}
              />
            </td>
            <td className={getCellClasses(10)}>
              <span
                className={`tabular-nums ${
                  moneyValues[valueIn].weight < 0
                    ? "text-red-600"
                    : moneyValues[valueIn].weight > 0
                      ? "text-emerald-600"
                      : "text-slate-600"
                } ${onWeightClick && !isCashRelated(asset) ? "cursor-pointer hover:underline decoration-dotted underline-offset-2" : ""}`}
                onClick={
                  onWeightClick && !isCashRelated(asset)
                    ? (e) => {
                        e.stopPropagation()
                        onWeightClick({
                          asset,
                          currentWeight: moneyValues[valueIn].weight * 100,
                          currentQuantity: quantityValues.total,
                          currentPrice:
                            moneyValues[valueIn].priceData?.close || 0,
                        })
                      }
                    : undefined
                }
                title={
                  onWeightClick && !isCashRelated(asset)
                    ? "Rebalance"
                    : undefined
                }
              >
                <FormatValue
                  value={moneyValues[valueIn].weight}
                  multiplier={100}
                  isPublic
                />
                %
              </span>
            </td>
            <td className={`${getCellClasses(11)} relative overflow-visible`}>
              <AlphaProgress
                irr={moneyValues[valueIn].irr}
                lastTradeDate={dateValues?.opened || undefined}
                className="min-w-[80px]"
              />
            </td>
            <td className={getCellClasses(12)}>
              <ResponsiveFormatValue
                value={convert(moneyValues[valueIn].totalGain)}
              />
            </td>
          </tr>
        ),
      )}
      {newsPopup && (
        <tr>
          <td>{newsPopup}</td>
        </tr>
      )}
    </tbody>
  )
}
