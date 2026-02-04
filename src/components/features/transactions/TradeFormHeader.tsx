import React from "react"
import { Controller, Control } from "react-hook-form"
import { NumericFormat } from "react-number-format"
import TradeStatusToggle from "@components/ui/TradeStatusToggle"
import { WeightInfo } from "@lib/trns/tradeFormHelpers"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import { Portfolio } from "types/beancounter"

interface TradeFormHeaderProps {
  isEditMode: boolean
  editAssetCode: string
  editAssetName: string
  editMarketCode: string
  asset: string
  portfolio: Portfolio
  type: { value: string }
  isExpense: boolean
  cashImpact: boolean
  quantity: number
  price: number
  tradeAmount: number
  tradeCurrency: { value: string }
  weightInfo: WeightInfo | null
  onClose: () => void
  onDelete?: () => void
  handleCopy: () => void
  copyStatus: "idle" | "success" | "error"
  control: Control<any>
  t: any
}

const TradeFormHeader: React.FC<TradeFormHeaderProps> = ({
  isEditMode,
  editAssetCode,
  editAssetName,
  editMarketCode,
  asset,
  portfolio,
  type,
  isExpense,
  cashImpact,
  quantity,
  price,
  tradeAmount,
  tradeCurrency,
  weightInfo,
  onClose,
  onDelete,
  handleCopy,
  copyStatus,
  control,
  t,
}) => (
  <header className="flex-shrink-0 pb-3 border-b border-gray-100">
    <div className="flex items-center justify-between mb-3">
      <button
        className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        onClick={onClose}
        title={t("cancel")}
      >
        <i className="fas fa-times"></i>
      </button>
      <div
        className="text-center flex-1 px-3"
        title={isEditMode ? editAssetName || editAssetCode : undefined}
      >
        <div className="font-semibold text-gray-900 truncate">
          {isEditMode
            ? editAssetCode
            : stripOwnerPrefix(asset) || t("trade.market.title")}
        </div>
        {isEditMode && editAssetName && (
          <div className="text-xs text-gray-500 truncate mt-0.5">
            {editAssetName.length > 30
              ? `${editAssetName.substring(0, 30)}...`
              : editAssetName}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-0.5">
          {isEditMode
            ? editMarketCode
            : `${portfolio.code} - ${portfolio.name}`}
        </div>
      </div>
      <div className="flex gap-0.5">
        <button
          type="button"
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            copyStatus === "success"
              ? "text-green-600 bg-green-50"
              : copyStatus === "error"
                ? "text-red-500 bg-red-50"
                : "text-gray-400 hover:text-green-600 hover:bg-green-50"
          }`}
          onClick={handleCopy}
          title={t("copy")}
        >
          <i
            className={`fas ${copyStatus === "success" ? "fa-check" : copyStatus === "error" ? "fa-times" : "fa-copy"} text-xs`}
          ></i>
        </button>
        {isEditMode && (
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            onClick={onDelete}
            title={t("delete")}
          >
            <i className="fas fa-trash-can text-xs"></i>
          </button>
        )}
      </div>
    </div>

    {/* Trade Status Toggle */}
    <div className="flex justify-center mb-3">
      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <TradeStatusToggle
            isSettled={field.value.value === "SETTLED"}
            onChange={(isSettled) => {
              const newStatus = isSettled ? "SETTLED" : "PROPOSED"
              field.onChange({ value: newStatus, label: newStatus })
            }}
            size="sm"
          />
        )}
      />
    </div>

    {/* Trade Value Summary */}
    <div
      className={`rounded-lg p-3 flex items-center justify-center gap-4 ${
        type?.value === "SELL" || isExpense
          ? "bg-red-50 border border-red-100"
          : type?.value === "ADD" || type?.value === "REDUCE"
            ? "bg-blue-50 border border-blue-100"
            : "bg-emerald-50 border border-emerald-100"
      }`}
    >
      <div className="text-center">
        <div
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            type?.value === "SELL" || isExpense
              ? "text-red-500"
              : type?.value === "ADD" || type?.value === "REDUCE"
                ? "text-blue-500"
                : "text-emerald-600"
          }`}
        >
          {type?.value || "BUY"}
        </div>
        {isExpense ? (
          <>
            <div className="font-bold text-lg text-gray-900">
              <NumericFormat
                value={tradeAmount || 0}
                displayType="text"
                thousandSeparator
                decimalScale={2}
                fixedDecimalScale
              />
            </div>
            <div className="text-xs text-gray-500">{tradeCurrency?.value}</div>
          </>
        ) : (
          <>
            <div className="font-bold text-lg text-gray-900">
              <NumericFormat
                value={quantity || 0}
                displayType="text"
                thousandSeparator
                decimalScale={2}
              />
              {!cashImpact && (
                <span className="text-gray-400 text-sm ml-1">
                  {t("trn.units", "units")}
                </span>
              )}
            </div>
            {cashImpact && (
              <div className="text-xs text-gray-500">
                @ {price?.toFixed(2)} {tradeCurrency?.value}
              </div>
            )}
          </>
        )}
      </div>
      {cashImpact && tradeAmount > 0 && !isExpense && (
        <>
          <div className="text-gray-300">
            <i className="fas fa-arrow-right text-xs"></i>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t("trn.amount.trade")}
            </div>
            <div className="font-bold text-lg text-gray-900">
              <NumericFormat
                value={tradeAmount}
                displayType="text"
                thousandSeparator
                decimalScale={2}
                fixedDecimalScale
              />
            </div>
            <div className="text-xs text-gray-500">{tradeCurrency?.value}</div>
          </div>
        </>
      )}
    </div>

    {/* Weight info */}
    {weightInfo && !isExpense && (
      <div className="mt-2 text-center text-xs font-medium text-blue-600">
        {weightInfo.label}: {weightInfo.value.toFixed(2)}%
        {weightInfo.tradeWeight !== undefined && (
          <span className="text-gray-400 ml-2">
            ({type.value === "SELL" ? "-" : "+"}
            {weightInfo.tradeWeight.toFixed(2)}%)
          </span>
        )}
      </div>
    )}
  </header>
)

export default TradeFormHeader
