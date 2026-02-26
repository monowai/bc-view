import React, { useState } from "react"
import { Asset } from "types/beancounter"
import { stripOwnerPrefix, getAssetCurrency } from "@lib/assets/assetUtils"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

const CATEGORY_LABELS: Record<string, string> = {
  PENSION: "Retirement Fund",
  ACCOUNT: "Bank Account",
  TRADE: "Trade Account",
  RE: "Real Estate",
  "MUTUAL FUND": "Mutual Fund",
  POLICY: "Retirement Fund",
}
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"

interface SetPriceDialogProps {
  asset: Asset
  onClose: () => void
  onSave: (assetId: string, date: string, price: string) => Promise<void>
}

const SetPriceDialog: React.FC<SetPriceDialogProps> = ({
  asset,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [price, setPrice] = useState("")
  const {
    isSubmitting,
    submitError: error,
    handleSubmit,
    setError,
  } = useDialogSubmit({ fallbackError: "Failed to set price" })

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
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label={"Save"}
            loadingLabel={"Saving..."}
            isSubmitting={isSubmitting}
          />
        </>
      }
    >
      <Alert variant="info">
        <div className="font-semibold text-lg">{asset.name}</div>
        <div className="text-sm text-gray-600">
          {stripOwnerPrefix(asset.code)} -{" "}
          {CATEGORY_LABELS[asset.assetCategory?.id || ""] ||
            asset.assetCategory?.name ||
            "-"}
        </div>
      </Alert>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Price Date"}
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Price Value"} ({getAssetCurrency(asset) || "USD"})
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={"Current market value or valuation"}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {error && <Alert>{error}</Alert>}
    </Dialog>
  )
}

export default SetPriceDialog
