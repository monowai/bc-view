import React, { useState } from "react"
import { Asset } from "types/beancounter"
import { useTranslation } from "next-i18next"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"
import Dialog from "@components/ui/Dialog"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"

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
  const { t } = useTranslation("common")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [price, setPrice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (): Promise<void> => {
    if (!price || parseFloat(price) <= 0) {
      setError(t("price.error.invalid"))
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave(asset.id, date, price)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("price.error.failed"))
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="font-semibold text-lg">{asset.name}</div>
        <div className="text-sm text-gray-600">
          {stripOwnerPrefix(asset.code)} -{" "}
          {t(`category.${asset.assetCategory?.id}`) ||
            asset.assetCategory?.name}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("price.date")}
        </label>
        <DateInput
          value={date}
          onChange={setDate}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("price.value")} (
          {asset.priceSymbol || asset.market?.currency?.code || "USD"})
        </label>
        <MathInput
          value={price ? parseFloat(price) : 0}
          onChange={(value) => setPrice(String(value))}
          placeholder={t("price.value.hint")}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
