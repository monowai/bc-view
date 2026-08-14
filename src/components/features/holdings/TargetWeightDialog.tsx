import React, { useState, useMemo } from "react"
import { Asset, Portfolio, RebalanceData } from "types/beancounter"
import MathInput from "@components/ui/MathInput"
import Dialog from "@components/ui/Dialog"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import { calculateQuantityFromTargetWeight } from "@lib/trns/tradeFormHelpers"

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
  // Trade-currency -> portfolio-currency rate (see WeightClickData.fxRate).
  // Defaults to 1 — same-currency asset/portfolio, or a caller that hasn't
  // been updated to supply it yet.
  fxRate?: number
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
  fxRate = 1,
}) => {
  // Parent (pages/holdings/[code].tsx) conditionally mounts this dialog,
  // so the initial useState already gives fresh state on each open.
  const [targetWeight, setTargetWeight] = useState<number>(currentWeight)

  // Calculate required shares and action type. `currentPrice` is the asset's
  // TRADE currency but `portfolio.marketValue` (and so the weight-derived
  // valueDiff) is portfolio currency — `calculateQuantityFromTargetWeight`
  // applies `fxRate` to reconcile them, same fix as the trade dialog's
  // target-weight sizing (#1156). Without it, a foreign-currency asset's
  // required-share count is silently wrong by the fx ratio.
  const calculation = useMemo(() => {
    const portfolioValue = portfolio.marketValue
    if (portfolioValue <= 0 || currentPrice <= 0) {
      return { shares: 0, type: "BUY" as const }
    }

    // For selling to 0%, use all current shares
    if (targetWeight === 0 && currentQuantity > 0) {
      return { shares: currentQuantity, type: "SELL" as const }
    }

    const result = calculateQuantityFromTargetWeight(
      targetWeight,
      currentWeight,
      currentPrice,
      portfolioValue,
      fxRate,
    )
    if (!result) {
      return { shares: 0, type: "BUY" as const }
    }

    return { shares: result.quantity, type: result.tradeType }
  }, [
    targetWeight,
    currentWeight,
    portfolio.marketValue,
    currentPrice,
    currentQuantity,
    fxRate,
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
      title={"Rebalance Position"}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={handleProceed}
            label={"Proceed"}
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
          {"Current Weight"}
        </span>
        <span className="text-lg font-bold">{currentWeight.toFixed(2)}%</span>
      </div>

      {/* Target Weight Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Target Weight"}
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
          <span className="text-sm font-medium">{"Action"}</span>
          <span
            className={`font-bold ${
              calculation.type === "BUY" ? "text-green-600" : "text-red-600"
            }`}
          >
            {calculation.type === "BUY" ? "Buy" : "Sell"}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{"Required Shares"}</span>
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
