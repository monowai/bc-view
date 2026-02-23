import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
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
        setError(
          errorData.detail || errorData.message || "Failed to execute plan",
        )
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
    <Dialog
      title={"Execute Plan"}
      onClose={handleClose}
      maxWidth="lg"
      scrollable={true}
      footer={
        results ? (
          <Dialog.SubmitButton
            onClick={handleClose}
            label={"Done"}
            variant="blue"
          />
        ) : (
          <>
            <Dialog.CancelButton onClick={handleClose} label={"Cancel"} />
            <Dialog.SubmitButton
              onClick={handleExecute}
              label={"Execute"}
              loadingLabel={"Executing..."}
              isSubmitting={isExecuting}
              disabled={eligibleItems.length === 0}
              variant="green"
            />
          </>
        )
      }
    >
      <Dialog.ErrorAlert message={error} />

      {results ? (
        <ExecutionResultsView results={results} />
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <i className="fas fa-info-circle"></i>
              <span className="font-medium">{"Execution Summary"}</span>
            </div>
            <div className="text-sm space-y-1">
              <p>{`${eligibleItems.length} items eligible for execution`}</p>
              <div className="flex gap-4 mt-2">
                <span className="text-green-600">
                  <i className="fas fa-plus mr-1"></i>
                  {eligibleItems.filter((i) => i.action === "BUY").length} buys
                </span>
                <span className="text-red-600">
                  <i className="fas fa-minus mr-1"></i>
                  {eligibleItems.filter((i) => i.action === "SELL").length}{" "}
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
                <span className="font-medium">{"Warning"}</span>
              </div>
              <p className="text-sm mt-1">
                {
                  "Settled transactions will immediately affect your holdings and valuations."
                }
              </p>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

export default ExecutionDialog
