import React, { useState, useMemo } from "react"
import { Portfolio } from "types/beancounter"
import {
  calculateCashAdjustment,
  CashBalanceAdjustment,
} from "@lib/trns/tradeUtils"
import MathInput from "@components/ui/MathInput"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

interface SetCashBalanceDialogProps {
  modalOpen: boolean
  onClose: () => void
  portfolio: Portfolio
  currency: string
  currentBalance: number
  assetId: string // The cash asset being adjusted; also the settlement account
  assetCode?: string // Asset code for bank accounts
  assetName?: string // Asset name for display
}

const SetCashBalanceDialog: React.FC<SetCashBalanceDialogProps> = ({
  modalOpen,
  onClose,
  portfolio,
  currency,
  currentBalance,
  assetId,
  assetCode,
  assetName,
}) => {
  const [targetBalance, setTargetBalance] = useState<string>("")
  const { isSubmitting, submitError, submitSuccess, handleSubmit, reset } =
    useDialogSubmit({
      onSuccess: onClose,
      autoCloseDelay: 1000,
      fallbackError: "Failed to submit transaction",
    })

  // Reset state when modal opens. Render-phase reset on prop change (React's
  // "store previous value" pattern) instead of an effect, to avoid cascading
  // renders.
  const [prevModalOpen, setPrevModalOpen] = useState(modalOpen)
  if (modalOpen !== prevModalOpen) {
    setPrevModalOpen(modalOpen)
    if (modalOpen) {
      setTargetBalance("")
      reset()
    }
  }

  // Calculate required transaction using shared utility
  const calculation = useMemo((): CashBalanceAdjustment => {
    const target = parseFloat(targetBalance)
    if (isNaN(target)) {
      return { amount: 0, type: "DEPOSIT", newBalance: currentBalance }
    }
    return calculateCashAdjustment(currentBalance, target)
  }, [targetBalance, currentBalance])

  /**
   * Writes the adjustment through the synchronous trn endpoint.
   *
   * This used to publish a row to the async CSV import topic, where a server-side
   * rejection was retried, acked away and never seen — the dialog reported success
   * and no transaction existed (#1067). The cash asset settles against itself, so
   * cashAssetId is the asset being adjusted. tradeDate is left to the server, which
   * resolves "today" in the configured zone rather than the browser's.
   */
  const handleProceed = async (): Promise<void> => {
    if (calculation.amount === 0) return
    await handleSubmit(async () => {
      const displayName = assetName || assetCode || currency
      const response = await fetch("/api/trns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: portfolio.id,
          data: [
            {
              assetId,
              cashAssetId: assetId,
              trnType: calculation.type,
              quantity: calculation.amount,
              // The import path set both; cashAmount is what the cash ladder reads,
              // and the backend signs it from the trn type.
              cashAmount: calculation.amount,
              tradeCurrency: currency,
              cashCurrency: currency,
              status: "SETTLED",
              comments: `Set ${displayName} balance to ${currency} ${calculation.newBalance.toFixed(2)}`,
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.message || errorData.detail || "Failed to set balance",
        )
      }
    })
  }

  if (!modalOpen) {
    return null
  }

  const hasValidTarget =
    targetBalance !== "" &&
    !isNaN(parseFloat(targetBalance)) &&
    calculation.amount > 0

  return (
    <Dialog
      title={"Set Balance"}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          {submitSuccess ? (
            <button
              type="button"
              className="px-4 py-2 rounded transition-colors text-white bg-green-600"
              disabled
            >
              <span className="flex items-center">
                <i className="fas fa-check mr-2"></i>
                {"Success"}
              </span>
            </button>
          ) : (
            <Dialog.SubmitButton
              onClick={handleProceed}
              label={"Proceed"}
              loadingLabel={"Submitting..."}
              isSubmitting={isSubmitting}
              disabled={!hasValidTarget}
              variant={calculation.type === "DEPOSIT" ? "green" : "red"}
            />
          )}
        </>
      }
    >
      {/* Currency/Account Info */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="font-semibold text-lg">
          {assetName || assetCode || `${currency} Cash`}
        </div>
        {assetCode && <div className="text-sm text-gray-500">{currency}</div>}
      </div>

      {/* Current Balance */}
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">
          {"Current Balance"}
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
          {"Target Balance"}
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
            <span className="text-sm font-medium">{"Action"}</span>
            <span
              className={`font-bold ${
                calculation.type === "DEPOSIT"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {calculation.type === "DEPOSIT" ? "Deposit" : "Withdraw"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{"Amount"}</span>
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
                {"New Balance"}
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
            {"No change needed"}
          </div>
        )}

      <Dialog.ErrorAlert message={submitError} />
    </Dialog>
  )
}

export default SetCashBalanceDialog
