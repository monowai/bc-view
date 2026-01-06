import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "next-i18next"
import { Portfolio } from "types/beancounter"
import { postData } from "@components/ui/DropZone"
import {
  buildCashRow,
  calculateCashAdjustment,
  CashBalanceAdjustment,
} from "@lib/trns/tradeUtils"
import MathInput from "@components/ui/MathInput"

interface SetCashBalanceDialogProps {
  modalOpen: boolean
  onClose: () => void
  portfolio: Portfolio
  currency: string
  currentBalance: number
  market?: string // "CASH" for currencies, "PRIVATE" for bank accounts
  assetCode?: string // Asset code for bank accounts
  assetName?: string // Asset name for display
}

const SetCashBalanceDialog: React.FC<SetCashBalanceDialogProps> = ({
  modalOpen,
  onClose,
  portfolio,
  currency,
  currentBalance,
  market = "CASH",
  assetCode,
  assetName,
}) => {
  const { t } = useTranslation("common")
  const [targetBalance, setTargetBalance] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTargetBalance("")
      setIsSubmitting(false)
      setSubmitError(null)
      setSubmitSuccess(false)
    }
  }, [modalOpen])

  // Calculate required transaction using shared utility
  const calculation = useMemo((): CashBalanceAdjustment => {
    const target = parseFloat(targetBalance)
    if (isNaN(target)) {
      return { amount: 0, type: "DEPOSIT", newBalance: currentBalance }
    }
    return calculateCashAdjustment(currentBalance, target)
  }, [targetBalance, currentBalance])

  const handleProceed = async (): Promise<void> => {
    if (calculation.amount === 0) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const displayName = assetName || assetCode || currency
      const row = buildCashRow({
        type: calculation.type,
        currency,
        amount: calculation.amount,
        comments: `Set ${displayName} balance to ${currency} ${calculation.newBalance.toFixed(2)}`,
        market,
        assetCode,
      })

      await postData(portfolio, false, row)
      setSubmitSuccess(true)

      // Close after a brief delay to show success
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit transaction",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!modalOpen) {
    return null
  }

  const hasValidTarget =
    targetBalance !== "" &&
    !isNaN(parseFloat(targetBalance)) &&
    calculation.amount > 0

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
          <h2 className="text-xl font-semibold">{t("cash.setBalance")}</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="space-y-4">
          {/* Currency/Account Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-semibold text-lg">
              {assetName || assetCode || `${currency} Cash`}
            </div>
            {assetCode && (
              <div className="text-sm text-gray-500">{currency}</div>
            )}
          </div>

          {/* Current Balance */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              {t("cash.currentBalance")}
            </span>
            <span className="text-lg font-bold">
              {currency}{" "}
              {currentBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Target Balance Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("cash.targetBalance")}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{currency}</span>
              <MathInput
                value={targetBalance === "" ? "" : parseFloat(targetBalance)}
                onChange={(value) => setTargetBalance(String(value))}
                placeholder={currentBalance.toFixed(2)}
                className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Calculation Result */}
          {hasValidTarget && (
            <div
              className={`rounded-lg p-4 ${
                calculation.type === "DEPOSIT"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{t("cash.action")}</span>
                <span
                  className={`font-bold ${
                    calculation.type === "DEPOSIT"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {calculation.type === "DEPOSIT"
                    ? t("cash.deposit")
                    : t("cash.withdrawal")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t("cash.amount")}</span>
                <span className="text-2xl font-bold">
                  {currency}{" "}
                  {calculation.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    {t("cash.newBalance")}
                  </span>
                  <span className="text-lg font-semibold text-purple-600">
                    {currency}{" "}
                    {calculation.newBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* No change message */}
          {targetBalance !== "" &&
            !isNaN(parseFloat(targetBalance)) &&
            calculation.amount === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                {t("cash.noChangeNeeded")}
              </div>
            )}

          {/* Error message */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {submitError}
            </div>
          )}
        </div>

        {/* Actions */}
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
                : submitSuccess
                  ? "bg-green-600"
                  : calculation.type === "DEPOSIT"
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-red-500 hover:bg-red-600"
            }`}
            onClick={handleProceed}
            disabled={!hasValidTarget || isSubmitting || submitSuccess}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("submitting")}
              </span>
            ) : submitSuccess ? (
              <span className="flex items-center">
                <i className="fas fa-check mr-2"></i>
                {t("success")}
              </span>
            ) : (
              t("cash.proceed")
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SetCashBalanceDialog
