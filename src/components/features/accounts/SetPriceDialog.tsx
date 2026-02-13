import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { Asset } from "types/beancounter"
import { stripOwnerPrefix, getAssetCurrency } from "@lib/assets/assetUtils"
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
  const { t } = useTranslation(["common", "wealth"])
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [price, setPrice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (): Promise<void> => {
    if (!price || parseFloat(price) <= 0) {
      setError(t("wealth:error.invalidPrice"))
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave(asset.id, date, price)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("wealth:error.setPriceFailed"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      title={t("price.set.title")}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label={t("save")}
            loadingLabel={t("saving")}
            isSubmitting={isSubmitting}
          />
        </>
      }
    >
      <Alert variant="info">
        <div className="font-semibold text-lg">{asset.name}</div>
        <div className="text-sm text-gray-600">
          {stripOwnerPrefix(asset.code)} -{" "}
          {t(`category.${asset.assetCategory?.id}`, {
            defaultValue: asset.assetCategory?.name || "-",
          })}
        </div>
      </Alert>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("price.date")}
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
          {t("price.value")} ({getAssetCurrency(asset) || "USD"})
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={t("price.value.hint")}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {error && <Alert>{error}</Alert>}
    </Dialog>
  )
}

export default SetPriceDialog
