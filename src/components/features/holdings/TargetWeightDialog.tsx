import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "next-i18next"
import { Asset, Portfolio, RebalanceData } from "types/beancounter"
import MathInput from "@components/ui/MathInput"
import Dialog from "@components/ui/Dialog"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"

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
    const assetCode = stripOwnerPrefix(asset.code)
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

  const assetCode = stripOwnerPrefix(asset.code)

  return (
    <Dialog
      title={t("rebalance.title")}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton
            onClick={onClose}
            label={t("rebalance.cancel")}
          />
          <Dialog.SubmitButton
            onClick={handleProceed}
            label={t("rebalance.proceed")}
            disabled={calculation.shares === 0}
            variant={calculation.type === "BUY" ? "green" : "red"}
          />
        </>
      }
    >
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
            onChange={(value) =>
              setTargetWeight(Math.max(0, Math.min(100, value)))
            }
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
    </Dialog>
  )
}

export default TargetWeightDialog
