import React, { useEffect, useMemo, useState, useRef } from "react"
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
  Asset,
} from "types/beancounter"
import {
  FormatValue,
  ResponsiveFormatValue,
  PrivateQuantity,
} from "@components/ui/MoneyUtils"
import {
  isCash,
  isCashRelated,
  isAccount,
  isConstantPrice,
  supportsBalanceSetting,
  stripOwnerPrefix,
  getAssetCurrency,
} from "@lib/assets/assetUtils"
import Link from "next/link"
import { useRouter } from "next/router"
import { AlphaProgress } from "@components/ui/ProgressBar"
import { useTranslation } from "next-i18next"
import { useDisplayCurrencyConversion } from "@lib/hooks/useDisplayCurrencyConversion"
import { getCellClasses } from "@lib/holdings/cellClasses"

export interface CorporateActionsData {
  asset: Asset
  portfolioId: string
  fromDate: string
  closedDate?: string // Position closed date - events after this should be ignored
}

export interface SectorWeightingsData {
  asset: Asset
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
  onRecordIncome?: (data: QuickSellData) => void
  onRecordExpense?: (data: QuickSellData) => void
}

// Helper function to truncate text with ellipsis
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

// Actions dropdown menu component
interface ActionsMenuProps {
  asset: Asset
  portfolioId: string
  fromDate?: string
  closedDate?: string
  quantity: number
  price: number
  costBasis: number
  tradeCurrency: { code: string; symbol: string; name: string }
  valueIn: string
  held?: Record<string, number> // Broker name -> quantity for QuickSell
  onQuickSell?: (data: QuickSellData) => void
  onCorporateActions?: (data: CorporateActionsData) => void
  onSetPrice?: (data: SetPriceData) => void
  onSetBalance?: (data: SetBalanceData) => void
  onSectorWeightings?: (data: SectorWeightingsData) => void
  onCostAdjust?: (data: CostAdjustData) => void
  onRecordIncome?: (data: QuickSellData) => void
  onRecordExpense?: (data: QuickSellData) => void
  t: any
}

const ActionsMenu: React.FC<ActionsMenuProps> = ({
  asset,
  portfolioId,
  fromDate,
  closedDate,
  quantity,
  price,
  costBasis,
  tradeCurrency,
  held,
  onQuickSell,
  onCorporateActions,
  onSetPrice,
  onSetBalance,
  onSectorWeightings,
  onCostAdjust,
  onRecordIncome,
  onRecordExpense,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const assetCode = stripOwnerPrefix(asset.code)

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label={`${t("actions.menu")} ${assetCode}`}
        className="inline-flex items-center justify-center w-8 h-8 min-w-[44px] min-h-[44px] -m-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors duration-150"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        title={t("actions.menu")}
      >
        <i className="fas fa-ellipsis-vertical text-sm"></i>
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-xl z-50 border border-slate-200">
          <div className="py-1">
            {onQuickSell && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  onQuickSell({
                    asset: assetCode,
                    market: asset.market.code,
                    quantity,
                    price,
                    held,
                  })
                }}
              >
                <i className="fas fa-money-bill-transfer text-red-500 w-4"></i>
                {t("actions.quickSell")}
              </button>
            )}
            {onCorporateActions && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  onCorporateActions({
                    asset,
                    portfolioId,
                    fromDate: fromDate || "",
                    closedDate,
                  })
                }}
              >
                <i className="fas fa-calendar-check text-blue-500 w-4"></i>
                {t("corporate.view")}
              </button>
            )}
            {asset.market?.code === "PRIVATE" &&
              isConstantPrice(asset) &&
              onSetBalance && (
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(false)
                    onSetBalance({ asset })
                  }}
                >
                  <i className="fas fa-piggy-bank text-amber-500 w-4"></i>
                  {t("balance.set")}
                </button>
              )}
            {onSetPrice &&
              asset.market?.code === "PRIVATE" &&
              !isConstantPrice(asset) && (
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(false)
                    onSetPrice({ asset })
                  }}
                >
                  <i className="fas fa-tag text-green-500 w-4"></i>
                  {t("price.set")}
                </button>
              )}
            {onSectorWeightings && asset.assetCategory?.id === "ETF" && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  onSectorWeightings({ asset })
                }}
              >
                <i className="fas fa-chart-pie text-purple-500 w-4"></i>
                {t("sector.weightings.view")}
              </button>
            )}
            {onCostAdjust && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  onCostAdjust({
                    asset,
                    portfolioId,
                    currentCostBasis: costBasis,
                    currency: tradeCurrency,
                  })
                }}
              >
                <i className="fas fa-scale-balanced text-orange-500 w-4"></i>
                {t("costAdjust.menu")}
              </button>
            )}
            {onRecordIncome && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  onRecordIncome({
                    asset: assetCode,
                    assetId: asset.id,
                    currency: tradeCurrency.code,
                    market: asset.market.code,
                    quantity: 0,
                    price: 0,
                    type: "INCOME",
                  })
                }}
              >
                <i className="fas fa-arrow-down text-green-500 w-4"></i>
                {t("actions.recordIncome", "Record Income")}
              </button>
            )}
            {onRecordExpense && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  onRecordExpense({
                    asset: assetCode,
                    assetId: asset.id,
                    currency: tradeCurrency.code,
                    market: asset.market.code,
                    quantity: 0,
                    price: 0,
                    type: "EXPENSE",
                  })
                }}
              >
                <i className="fas fa-arrow-up text-red-500 w-4"></i>
                {t("actions.recordExpense", "Record Expense")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Cash actions dropdown menu component
interface CashActionsMenuProps {
  asset: Asset
  portfolio: { id: string; code: string }
  marketValue: number
  onSetCashBalance?: (data: SetCashBalanceData) => void
  onCashTransfer?: (data: CashTransferData) => void
  onCashTransaction?: (assetCode: string) => void
  t: (key: string) => string
}

const CashActionsMenu: React.FC<CashActionsMenuProps> = ({
  asset,
  portfolio,
  marketValue,
  onSetCashBalance,
  onCashTransfer,
  onCashTransaction,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const assetCode = stripOwnerPrefix(asset.code)

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label={`${t("actions.menu")} ${assetCode}`}
        className="inline-flex items-center justify-center w-8 h-8 min-w-[44px] min-h-[44px] -m-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors duration-150"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        title={t("actions.menu")}
      >
        <i className="fas fa-ellipsis-vertical text-sm"></i>
      </button>
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-lg shadow-xl z-50 border border-slate-200">
          <div className="py-1">
            {onSetCashBalance && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  const isAccountAsset = isAccount(asset)
                  onSetCashBalance({
                    currency: isAccountAsset
                      ? getAssetCurrency(asset) || asset.code
                      : asset.code,
                    currentBalance: marketValue,
                    market: isAccountAsset ? "PRIVATE" : "CASH",
                    assetCode: isAccountAsset ? asset.code : undefined,
                    assetName: isAccountAsset ? asset.name : undefined,
                  })
                }}
              >
                <i className="fas fa-balance-scale text-purple-500 w-4"></i>
                {t("cash.setBalance")}
              </button>
            )}
            {onCashTransfer && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  const isAccountAsset = isAccount(asset)
                  onCashTransfer({
                    portfolioId: portfolio.id,
                    portfolioCode: portfolio.code,
                    assetId: asset.id,
                    assetCode: asset.code,
                    assetName: asset.name || asset.code,
                    currency: isAccountAsset
                      ? getAssetCurrency(asset) || asset.code
                      : asset.code,
                    currentBalance: marketValue,
                  })
                }}
              >
                <i className="fas fa-exchange-alt text-blue-500 w-4"></i>
                {t("cash.transfer.title")}
              </button>
            )}
            {onCashTransaction && (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  onCashTransaction(assetCode)
                }}
              >
                <i className="fas fa-dollar-sign text-green-500 w-4"></i>
                {t("trade.cash.title")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
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
  onRecordIncome,
  onRecordExpense,
}: RowsProps): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()

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
                : router.push(`/trns/trades/${portfolio.id}/${asset.id}`)
            }
            title={t("actions.doubleClickToOpen")}
          >
            <td className="px-1 py-1.5 sm:px-2 md:px-3 text-ellipsis min-w-0">
              {/* Unified layout: code on top, name below for both mobile and desktop */}
              <div className="flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm sm:text-base text-slate-900"
                    title={stripOwnerPrefix(asset.code)}
                  >
                    {isCash(asset) ? asset.name : stripOwnerPrefix(asset.code)}
                  </div>
                  {!isCash(asset) && asset.name && (
                    <div
                      className="text-[10px] xl:text-xs text-slate-500 truncate max-w-[120px] sm:max-w-[180px] xl:max-w-none"
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
                      onRecordIncome={onRecordIncome}
                      onRecordExpense={onRecordExpense}
                      t={t}
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
                        t={t}
                      />
                    </div>
                  )}
              </div>
            </td>
            <td className={getCellClasses(0)}>
              {hideValue(moneyValues[valueIn].priceData) ||
              !moneyValues[valueIn].priceData?.close ? (
                " "
              ) : (
                <span className="relative group">
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
                </span>
              )}
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
                    ? t("actions.rebalance")
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
    </tbody>
  )
}
