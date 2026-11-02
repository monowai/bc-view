import React, { useState } from "react"
import { Asset } from "types/beancounter"
import MathInput from "@components/ui/MathInput"
import Dialog from "@components/ui/Dialog"
import { getAssetCurrency } from "@lib/assets/assetUtils"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { todayIso } from "@lib/formatters"
import {
  ASSET_DIALOG_INPUT_CLASS,
  AssetDateField,
  AssetIdentityCard,
  AssetSaveFooter,
} from "@components/features/assets/AssetDialogParts"

interface SetPriceDialogProps {
  asset: Asset
  onClose: () => void
  onSave: (assetId: string, date: string, price: string) => Promise<void>
}

export default function SetPriceDialog({
  asset,
  onClose,
  onSave,
}: SetPriceDialogProps): React.ReactElement {
  const [date, setDate] = useState(todayIso())
  const [price, setPrice] = useState("")
  const {
    isSubmitting,
    submitError: error,
    handleSubmit,
    setError,
  } = useDialogSubmit({ fallbackError: "Failed to update price" })

  const handleSave = async (): Promise<void> => {
    if (!price || parseFloat(price) <= 0) {
      setError("Please enter a valid price greater than 0")
      return
    }
    await handleSubmit(async () => {
      await onSave(asset.id, date, price)
    })
  }

  return (
    <Dialog
      title={"Set Asset Price"}
      onClose={onClose}
      footer={
        <AssetSaveFooter
          onClose={onClose}
          onSave={handleSave}
          isSubmitting={isSubmitting}
        />
      }
    >
      <AssetIdentityCard asset={asset} categoryFallback={"-"} />

      <AssetDateField label={"Price Date"} value={date} onChange={setDate} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Price Value"} ({getAssetCurrency(asset) || "USD"})
        </label>
        <MathInput
          value={price ? parseFloat(price) : 0}
          onChange={(value) => setPrice(String(value))}
          placeholder={"Current market value or valuation"}
          className={ASSET_DIALOG_INPUT_CLASS}
        />
      </div>

      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
