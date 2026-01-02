import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "next-i18next"
import { Asset, Portfolio, RebalanceData } from "types/beancounter"
import MathInput from "@components/ui/MathInput"

export type { RebalanceData }

interface TargetWeightDialogProps {
  modalOpen: boolean
  onClose: () => void
  onConfirm: (data: RebalanceData) => void
  asset: Asset
  portfolio: Portfolio
  currentWeight: number
  currentQuantity: number
  currentPrice: number
}

// Helper to extract asset code without market prefix
const getAssetCode = (code: string): string => {
  const dotIndex = code.indexOf(".")
  return dotIndex > 0 ? code.substring(dotIndex + 1) : code
}

const TargetWeightDialog: React.FC<TargetWeightDialogProps> = ({
  modalOpen,
  onClose,
  onConfirm,
  asset,
  portfolio,
  currentWeight,
  currentQuantity,
  currentPrice,
}) => {
  const { t } = useTranslation("common")
  const [targetWeight, setTargetWeight] = useState<number>(currentWeight)

  // Reset target weight when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTargetWeight(currentWeight)
    }
  }, [modalOpen, currentWeight])

  // Calculate required shares and action type
  const calculation = useMemo(() => {
    const portfolioValue = portfolio.marketValue
    if (portfolioValue <= 0 || currentPrice <= 0) {
      return { shares: 0, type: "BUY" as const }
    }

    const targetValue = (targetWeight / 100) * portfolioValue
    const currentValue = (currentWeight / 100) * portfolioValue
    const valueDiff = targetValue - currentValue

    // For selling to 0%, use all current shares
    if (targetWeight === 0 && currentQuantity > 0) {
      return { shares: currentQuantity, type: "SELL" as const }
    }

    const shares = Math.round(Math.abs(valueDiff) / currentPrice)
    const type = valueDiff >= 0 ? ("BUY" as const) : ("SELL" as const)

    return { shares, type }
  }, [
    targetWeight,
    currentWeight,
    portfolio.marketValue,
    currentPrice,
    currentQuantity,
  ])

  const handleProceed = (): void => {
    const assetCode = getAssetCode(asset.code)
    onConfirm({
      asset: assetCode,
      market: asset.market.code,
      quantity: calculation.shares,
      price: currentPrice,
      type: calculation.type,
      currentPositionQuantity: currentQuantity,
    })
    onClose()
  }

  if (!modalOpen) {
    return null
  }

  const assetCode = getAssetCode(asset.code)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl font-semibold">{t("rebalance.title")}</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="space-y-4">
          {/* Asset Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-semibold text-lg">{assetCode}</div>
            <div className="text-sm text-gray-600">{asset.name}</div>
            <div className="text-sm text-gray-500 mt-1">
              @ {portfolio.currency.symbol}
              {currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          {/* Current Weight */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              {t("rebalance.currentWeight")}
            </span>
            <span className="text-lg font-bold">
              {currentWeight.toFixed(2)}%
            </span>
          </div>

          {/* Target Weight Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("rebalance.targetWeight")}
            </label>
            <div className="flex items-center gap-2">
              <MathInput
                value={targetWeight}
                onChange={(value) => setTargetWeight(Math.max(0, Math.min(100, value)))}
                className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-500">%</span>
            </div>
          </div>

          {/* Calculation Result */}
          <div
            className={`rounded-lg p-4 ${
              calculation.type === "BUY"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                {t("rebalance.action")}
              </span>
              <span
                className={`font-bold ${
                  calculation.type === "BUY" ? "text-green-600" : "text-red-600"
                }`}
              >
                {calculation.type === "BUY"
                  ? t("rebalance.buy")
                  : t("rebalance.sell")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {t("rebalance.requiredShares")}
              </span>
              <span className="text-2xl font-bold">{calculation.shares}</span>
            </div>
            {calculation.shares > 0 && (
              <div className="text-xs text-gray-500 mt-2 text-right">
                {portfolio.currency.symbol}
                {(calculation.shares * currentPrice).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("rebalance.cancel")}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded transition-colors text-white ${
              calculation.shares === 0
                ? "bg-gray-400 cursor-not-allowed"
                : calculation.type === "BUY"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-red-500 hover:bg-red-600"
            }`}
            onClick={handleProceed}
            disabled={calculation.shares === 0}
          >
            {t("rebalance.proceed")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TargetWeightDialog
