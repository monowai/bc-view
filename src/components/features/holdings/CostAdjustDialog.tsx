import React, { useState, useMemo } from "react"
import { Asset, Currency } from "types/beancounter"
import { useTranslation } from "next-i18next"
import MathInput from "@components/ui/MathInput"
import DateInput from "@components/ui/DateInput"

// Extract display code without owner prefix (e.g., "userId.WISE" -> "WISE")
function getDisplayCode(code: string): string {
  const dotIndex = code.lastIndexOf(".")
  return dotIndex >= 0 ? code.substring(dotIndex + 1) : code
}

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
          <h2 className="text-xl font-semibold">{t("costAdjust.title")}</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="font-semibold text-lg">{asset.name}</div>
            <div className="text-sm text-gray-600">
              {getDisplayCode(asset.code)} -{" "}
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
                <span className="text-gray-600">
                  {t("costAdjust.adjustment")}
                </span>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded transition-colors text-white ${
              !hasValidTarget || isSubmitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600"
            }`}
            onClick={handleSave}
            disabled={!hasValidTarget || isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("saving")}
              </span>
            ) : (
              t("save")
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
