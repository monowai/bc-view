import React, { useState, useMemo } from "react"
import { Asset, Currency } from "types/beancounter"
import MathInput from "@components/ui/MathInput"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { todayIso } from "@lib/formatters"
import {
  ASSET_DIALOG_INPUT_CLASS,
  AssetDateField,
  AssetIdentityCard,
  AssetSaveFooter,
} from "@components/features/assets/AssetDialogParts"

interface CostAdjustDialogProps {
  asset: Asset
  portfolioId: string
  currentCostBasis: number
  currency: Currency
  onClose: () => void
  onSave: (
    assetId: string,
    portfolioId: string,
    date: string,
    adjustmentAmount: number,
  ) => Promise<void>
}

export default function CostAdjustDialog({
  asset,
  portfolioId,
  currentCostBasis,
  currency,
  onClose,
  onSave,
}: CostAdjustDialogProps): React.ReactElement {
  const [date, setDate] = useState(todayIso())
  const [newCostBasis, setNewCostBasis] = useState<string>("")
  const {
    isSubmitting,
    submitError: error,
    handleSubmit,
    setError,
  } = useDialogSubmit({ fallbackError: "Failed to create cost adjustment" })

  // Calculate the adjustment amount (new - current)
  const { adjustmentAmount, hasValidTarget } = useMemo(() => {
    const target = parseFloat(newCostBasis)
    if (isNaN(target) || newCostBasis === "") {
      return { adjustmentAmount: 0, hasValidTarget: false }
    }
    const adjustment = target - currentCostBasis
    return { adjustmentAmount: adjustment, hasValidTarget: adjustment !== 0 }
  }, [newCostBasis, currentCostBasis])

  const handleSave = async (): Promise<void> => {
    if (!hasValidTarget) {
      setError("Please enter a different cost basis")
      return
    }
    await handleSubmit(async () => {
      await onSave(asset.id, portfolioId, date, adjustmentAmount)
    })
  }

  return (
    <Dialog
      title={"Adjust Cost Basis"}
      onClose={onClose}
      footer={
        <AssetSaveFooter
          onClose={onClose}
          onSave={handleSave}
          isSubmitting={isSubmitting}
          disabled={!hasValidTarget || isSubmitting}
        />
      }
    >
      <AssetIdentityCard asset={asset} />

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{"Current Cost Basis"}</span>
          <span className="font-medium">
            {currency.symbol}
            {currentCostBasis.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <AssetDateField
        label={"Adjustment Date"}
        value={date}
        onChange={setDate}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"New Cost Basis"} ({currency.code})
        </label>
        <MathInput
          value={newCostBasis === "" ? "" : parseFloat(newCostBasis)}
          onChange={(value) => setNewCostBasis(String(value))}
          placeholder={currentCostBasis.toFixed(2)}
          className={ASSET_DIALOG_INPUT_CLASS}
        />
      </div>

      {hasValidTarget && (
        <div
          className={`border rounded-lg p-3 ${
            adjustmentAmount > 0
              ? "bg-green-50 border-green-200"
              : "bg-orange-50 border-orange-200"
          }`}
        >
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{"Adjustment"}</span>
            <span
              className={`font-medium ${adjustmentAmount > 0 ? "text-green-600" : "text-orange-600"}`}
            >
              {adjustmentAmount > 0 ? "+" : ""}
              {currency.symbol}
              {adjustmentAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          {parseFloat(newCostBasis) < 0 && (
            <p className="text-xs text-red-600 mt-1">
              {"Warning: New cost basis will be negative"}
            </p>
          )}
        </div>
      )}

      {newCostBasis !== "" &&
        !isNaN(parseFloat(newCostBasis)) &&
        !hasValidTarget && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-gray-500 text-sm">
            {"No change from current cost basis"}
          </div>
        )}

      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
