import React, { useEffect, useMemo, useState, useRef } from "react"
import {
  HoldingValues,
  PriceData,
  QuickSellData,
  WeightClickData,
  Asset,
} from "types/beancounter"
import { NumericFormat } from "react-number-format"
import { FormatValue } from "@components/ui/MoneyUtils"
import { isCashRelated, isCash } from "@lib/assets/assetUtils"
import { headers } from "./Header"
import Link from "next/link"
import { AlphaProgress } from "@components/ui/ProgressBar"
import { useTranslation } from "next-i18next"

export interface CorporateActionsData {
  asset: Asset
  portfolioId: string
  fromDate: string
}

interface RowsProps extends HoldingValues {
  onColumnsChange: (columns: string[]) => void
  onQuickSell?: (data: QuickSellData) => void
  onCorporateActions?: (data: CorporateActionsData) => void
  onWeightClick?: (data: WeightClickData) => void
}

// Helper function to generate responsive classes for table cells
const getCellClasses = (headerIndex: number): string => {
  const header = headers[headerIndex]
  let visibility
  if ("hidden" in header && header.hidden) {
    visibility = "hidden" // Hidden on all screens
  } else if (header.mobile) {
    visibility = ""
  } else if (header.medium) {
    visibility = "hidden sm:table-cell" // Hidden on mobile portrait, visible on landscape (640px+)
  } else {
    visibility = "hidden xl:table-cell"
  }

  // Reduce padding for mobile-visible columns to maximize space
  const isChangeColumn = headerIndex === 1
  const isMarketValueColumn = headerIndex === 5
  const isWeightColumn = headerIndex === 6
  const isIrrColumn = headerIndex === 10

  let padding
  if (isChangeColumn || isMarketValueColumn || isIrrColumn || isWeightColumn) {
    padding = "px-0.5 py-1 sm:px-1 md:px-2 xl:px-3" // Minimal padding on portrait for breathing room
  } else {
    padding = "px-0.5 py-1 sm:px-1 md:px-2 xl:px-3" // Minimal padding on portrait for breathing room
  }

  return `text-right ${padding} ${visibility}`
}

// Helper function to truncate text with ellipsis
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

// Helper to extract asset code without market prefix
const getAssetCode = (code: string): string => {
  const dotIndex = code.indexOf(".")
  return dotIndex > 0 ? code.substring(dotIndex + 1) : code
}

// Actions dropdown menu component
interface ActionsMenuProps {
  asset: Asset
  portfolioId: string
  fromDate?: string
  quantity: number
  price: number
  valueIn: string
  onQuickSell?: (data: QuickSellData) => void
  onCorporateActions?: (data: CorporateActionsData) => void
  t: (key: string) => string
}

const ActionsMenu: React.FC<ActionsMenuProps> = ({
  asset,
  portfolioId,
  fromDate,
  quantity,
  price,
  onQuickSell,
  onCorporateActions,
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

  const assetCode = getAssetCode(asset.code)

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label={`${t("actions.menu")} ${assetCode}`}
        className="inline-flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors duration-200"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        title={t("actions.menu")}
      >
        <i className="fas fa-ellipsis-vertical text-xs"></i>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
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
                  })
                }}
              >
                <i className="fas fa-calendar-check text-blue-500 w-4"></i>
                {t("corporate.view")}
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
}: RowsProps): React.ReactElement {
  const { t } = useTranslation("common")
  const columns = useMemo(
    () => [
      "Asset Code",
      "Asset Name",
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
        ({ asset, moneyValues, quantityValues, dateValues }, index) => (
          <tr
            key={groupBy + index}
            className="holding-row text-sm bg-white hover:!bg-slate-200 transition-colors duration-200 cursor-pointer"
          >
            <td className="px-0.5 py-1 sm:px-2 md:px-3 text-ellipsis min-w-0">
              {/* Unified layout: code on top, name below for both mobile and desktop */}
              <div className="flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm sm:text-base"
                    title={asset.code}
                  >
                    {isCash(asset)
                      ? asset.name
                      : asset.code.indexOf(".") > 0
                        ? asset.code.substring(asset.code.indexOf(".") + 1)
                        : asset.code}
                  </div>
                  {!isCash(asset) && (
                    <div
                      className="text-[10px] xl:text-xs text-gray-600"
                      title={asset.name}
                    >
                      {truncateText(asset.name, 20)}
                    </div>
                  )}
                </div>
                {!isCashRelated(asset) &&
                  (onQuickSell || onCorporateActions) && (
                    <div className="hidden sm:flex items-center">
                      <ActionsMenu
                        asset={asset}
                        portfolioId={portfolio.id}
                        fromDate={dateValues?.opened}
                        quantity={quantityValues.total}
                        price={moneyValues[valueIn].priceData?.close || 0}
                        valueIn={valueIn}
                        onQuickSell={onQuickSell}
                        onCorporateActions={onCorporateActions}
                        t={t}
                      />
                    </div>
                  )}
              </div>
            </td>
            <td className={getCellClasses(0)}>
              {hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : (
                <span className="relative group">
                  <span className="text-xs text-gray-500">
                    {moneyValues[valueIn].currency.symbol}
                  </span>
                  <FormatValue
                    value={moneyValues[valueIn].priceData?.close || " "}
                  />
                  <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
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
                  className={`relative group ${
                    moneyValues[valueIn].priceData.changePercent < 0
                      ? "text-red-500"
                      : "text-green-500"
                  }`}
                >
                  <span className="hidden sm:inline">
                    {moneyValues[valueIn].priceData.changePercent < 0
                      ? "▼ "
                      : "▲ "}
                  </span>
                  {(
                    Math.abs(moneyValues[valueIn].priceData.changePercent) * 100
                  ).toFixed(2)}
                  %
                  <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                    Change: {moneyValues[valueIn].currency.symbol}
                    {moneyValues[valueIn].gainOnDay?.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </span>
                </span>
              )}
            </td>
            <td className={getCellClasses(2)}>
              {hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : (
                <FormatValue value={moneyValues[valueIn].gainOnDay} />
              )}
            </td>

            <td className={getCellClasses(3)}>
              {isCashRelated(asset) ||
              hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : (
                <NumericFormat
                  value={quantityValues.total}
                  displayType="text"
                  decimalScale={quantityValues.precision}
                  fixedDecimalScale
                  thousandSeparator
                />
              )}
            </td>
            <td className={getCellClasses(4)}>
              <span className="relative group">
                <FormatValue value={moneyValues[valueIn].costValue} />
                <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                  Average: {moneyValues[valueIn].averageCost.toLocaleString()}
                </span>
              </span>
            </td>
            <td className={getCellClasses(5)}>
              <Link
                href={`/trns/trades`}
                as={`/trns/trades/${portfolio.id}/${asset.id}`}
                className="text-blue-600 hover:text-blue-800"
              >
                <FormatValue
                  value={moneyValues[valueIn].marketValue}
                  defaultValue="0"
                />
              </Link>
            </td>
            <td className={getCellClasses(6)}>
              <span
                className={`${
                  moneyValues[valueIn].weight < 0
                    ? "text-red-500"
                    : moneyValues[valueIn].weight > 0
                      ? "text-green-500"
                      : ""
                } ${onWeightClick && !isCashRelated(asset) ? "cursor-pointer hover:underline" : ""}`}
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
                />
                %
              </span>
            </td>
            <td className={getCellClasses(7)}>
              <span className="relative group">
                <Link
                  href={`/trns/events`}
                  as={`/trns/events/${portfolio.id}/${asset.id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <FormatValue value={moneyValues[valueIn].dividends} />
                </Link>
                <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                  Last Event: {dateValues?.lastDividend || "N/A"}
                </span>
              </span>
            </td>
            <td className={getCellClasses(8)}>
              <FormatValue value={moneyValues[valueIn].unrealisedGain} />
            </td>
            <td className={getCellClasses(9)}>
              <FormatValue value={moneyValues[valueIn].realisedGain} />
            </td>
            <td className={getCellClasses(10)}>
              {!isCashRelated(asset) && (
                <span
                  className={`relative group ${
                    moneyValues[valueIn].irr < 0
                      ? "text-red-500"
                      : moneyValues[valueIn].irr > 0
                        ? "text-green-500"
                        : ""
                  }`}
                >
                  <FormatValue
                    value={Math.abs(moneyValues[valueIn].irr)}
                    multiplier={100}
                  />
                  {"%"}
                  <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                    ROI: {(Math.abs(moneyValues[valueIn].roi) * 100).toFixed(2)}
                    %
                  </span>
                </span>
              )}
            </td>
            <td className={`${getCellClasses(11)} relative overflow-visible`}>
              <AlphaProgress
                irr={moneyValues[valueIn].irr}
                lastTradeDate={dateValues?.opened || undefined}
                className="min-w-[120px]"
              />
            </td>
            <td className={getCellClasses(12)}>
              <FormatValue value={moneyValues[valueIn].totalGain} />
            </td>
          </tr>
        ),
      )}
    </tbody>
  )
}
