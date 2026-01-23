import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import TransactionStatusSelect from "./TransactionStatusSelect"
import ExecutionResultsView from "./ExecutionResultsView"
import {
  RebalancePlanDto,
  TransactionStatus,
  ExecutionResultDto,
} from "types/rebalance"

interface ExecutionDialogProps {
  modalOpen: boolean
  onClose: () => void
  plan: RebalancePlanDto
  onSuccess: () => void
}

const ExecutionDialog: React.FC<ExecutionDialogProps> = ({
  modalOpen,
  onClose,
  plan,
  onSuccess,
}) => {
  const { t } = useTranslation("common")
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>("UNSETTLED")
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ExecutionResultDto | null>(null)

  // Get eligible items (not locked, not excluded)
  const eligibleItems = plan.items.filter(
    (item) => !item.locked && !item.excluded && item.action !== "HOLD",
  )

  const handleExecute = async (): Promise<void> => {
    setIsExecuting(true)
    setError(null)

    try {
      const response = await fetch(`/api/rebalance/plans/${plan.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionStatus,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.detail || errorData.message || "Failed to execute plan")
        return
      }

      const result = await response.json()
      setResults(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed")
    } finally {
      setIsExecuting(false)
    }
  }

  const handleClose = (): void => {
    if (results && results.executedCount > 0) {
      onSuccess()
    }
    setResults(null)
    setError(null)
    onClose()
  }

  if (!modalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={handleClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden z-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b p-4">
          <h2 className="text-xl font-semibold">
            {t("rebalance.execution.title", "Execute Plan")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            onClick={handleClose}
          >
            &times;
          </button>
        </header>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
              {error}
            </div>
          )}

          {results ? (
            <ExecutionResultsView results={results} />
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <i className="fas fa-info-circle"></i>
                  <span className="font-medium">
                    {t("rebalance.execution.summary", "Execution Summary")}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    {t(
                      "rebalance.execution.eligibleCount",
                      "{{count}} items eligible for execution",
                      { count: eligibleItems.length },
                    )}
                  </p>
                  <div className="flex gap-4 mt-2">
                    <span className="text-green-600">
                      <i className="fas fa-plus mr-1"></i>
                      {
                        eligibleItems.filter((i) => i.action === "BUY").length
                      }{" "}
                      buys
                    </span>
                    <span className="text-red-600">
                      <i className="fas fa-minus mr-1"></i>
                      {
                        eligibleItems.filter((i) => i.action === "SELL").length
                      }{" "}
                      sells
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Status Selector */}
              <TransactionStatusSelect
                value={transactionStatus}
                onChange={setTransactionStatus}
              />

              {/* Warning for settled */}
              {transactionStatus === "SETTLED" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span className="font-medium">
                      {t("rebalance.execution.settledWarning", "Warning")}
                    </span>
                  </div>
                  <p className="text-sm mt-1">
                    {t(
                      "rebalance.execution.settledWarningDesc",
                      "Settled transactions will immediately affect your holdings and valuations.",
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex justify-end space-x-2 p-4 border-t bg-gray-50">
          {results ? (
            <button
              type="button"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              onClick={handleClose}
            >
              {t("done", "Done")}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
                onClick={handleClose}
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded text-white transition-colors ${
                  eligibleItems.length > 0 && !isExecuting
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
                onClick={handleExecute}
                disabled={eligibleItems.length === 0 || isExecuting}
              >
                {isExecuting ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("rebalance.execution.executing", "Executing...")}
                  </span>
                ) : (
                  t("rebalance.execution.confirm", "Execute Plan")
                )}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

export default ExecutionDialog
