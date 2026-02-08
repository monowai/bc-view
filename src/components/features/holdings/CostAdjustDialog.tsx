import React, { useState, useMemo } from "react"
import { Asset, Currency } from "types/beancounter"
import { useTranslation } from "next-i18next"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"
import Dialog from "@components/ui/Dialog"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"

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
  const { t } = useTranslation("common")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [newCostBasis, setNewCostBasis] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(t("costAdjust.error.noChange"))
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave(asset.id, portfolioId, date, adjustmentAmount)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("costAdjust.error.failed"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      title={t("costAdjust.title")}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label={t("save")}
            loadingLabel={t("saving")}
            isSubmitting={isSubmitting}
            disabled={!hasValidTarget || isSubmitting}
            variant="green"
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

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {t("costAdjust.currentCostBasis")}
          </span>
          <span className="font-medium">
            {currency.symbol}
            {currentCostBasis.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("costAdjust.date")}
        </label>
        <DateInput
          value={date}
          onChange={setDate}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("costAdjust.newCostBasis")} ({currency.code})
        </label>
        <MathInput
          value={newCostBasis === "" ? "" : parseFloat(newCostBasis)}
          onChange={(value) => setNewCostBasis(String(value))}
          placeholder={currentCostBasis.toFixed(2)}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-green-500 focus:border-green-500"
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
            <span className="text-gray-600">{t("costAdjust.adjustment")}</span>
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
              {t("costAdjust.warning.negative")}
            </p>
          )}
        </div>
      )}

      {newCostBasis !== "" &&
        !isNaN(parseFloat(newCostBasis)) &&
        !hasValidTarget && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-gray-500 text-sm">
            {t("costAdjust.noChange")}
          </div>
        )}

      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
