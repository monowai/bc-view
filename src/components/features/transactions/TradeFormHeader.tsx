import React from "react"
import { Controller, Control } from "react-hook-form"
import TradeStatusToggle from "@components/ui/TradeStatusToggle"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import { Portfolio } from "types/beancounter"

interface TradeFormHeaderProps {
  isEditMode: boolean
  editAssetCode: string
  editAssetName: string
  editMarketCode: string
  asset: string
  portfolio: Portfolio
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
  </header>
)

export default TradeFormHeader
