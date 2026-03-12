import React, { useState, useEffect } from "react"
import Dialog from "@components/ui/Dialog"
import { Portfolio, MovePositionData } from "types/beancounter"
import { mutate } from "swr"
import { holdingKey } from "@utils/api/fetchHelper"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"

interface MovePositionDialogProps {
  modalOpen: boolean
  onClose: () => void
  sourceData: MovePositionData
  portfolios: Portfolio[]
}

const MovePositionDialog: React.FC<MovePositionDialogProps> = ({
  modalOpen,
  onClose,
  sourceData,
  portfolios,
}) => {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("")
  const [maintainCash, setMaintainCash] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Filter out the current portfolio from the target list
  const targetPortfolios = portfolios.filter(
    (p) => p.id !== sourceData.portfolioId,
  )

  // Reset state when modal opens
  useEffect(() => {
    if (modalOpen) {
      setSelectedPortfolioId(
        targetPortfolios.length > 0 ? targetPortfolios[0].id : "",
      )
      setMaintainCash(false)
      setIsSubmitting(false)
      setSubmitError(null)
      setSubmitSuccess(false)
    }
  }, [modalOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMove = async (): Promise<void> => {
    if (!selectedPortfolioId) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch("/api/trns/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePortfolioId: sourceData.portfolioId,
          targetPortfolioId: selectedPortfolioId,
          assetId: sourceData.asset.id,
          maintainCashBalances: maintainCash,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setSubmitError(
          errorData.message || errorData.detail || "Failed to move position",
        )
        return
      }

      setSubmitSuccess(true)
      // Invalidate cache immediately
      mutate(holdingKey(sourceData.portfolioCode, "today"))
      mutate("/api/holdings/aggregated?asAt=today")
      const targetPortfolio = portfolios.find(
        (p) => p.id === selectedPortfolioId,
      )
      if (targetPortfolio) {
        mutate(holdingKey(targetPortfolio.code, "today"))
      }
      // Close dialog after brief delay to show success state
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to move position",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!modalOpen) {
    return null
  }

  const assetCode = stripOwnerPrefix(sourceData.asset.code)
  const selectedTarget = portfolios.find((p) => p.id === selectedPortfolioId)

  const footer = (
    <>
      <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
      <Dialog.SubmitButton
        onClick={handleMove}
        label={submitSuccess ? "Success" : "Move Position"}
        loadingLabel={"Moving..."}
        isSubmitting={isSubmitting}
        disabled={!selectedPortfolioId || submitSuccess}
        variant={submitSuccess ? "green" : "purple"}
      />
    </>
  )

  return (
    <Dialog
      title={"Move Position"}
      onClose={onClose}
      maxWidth="md"
      scrollable={true}
      footer={footer}
    >
      <div className="space-y-4">
        {/* Source Info */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-sm text-gray-600">{"Source"}</div>
          <div className="font-semibold">{assetCode}</div>
          <div className="text-sm text-gray-500">{sourceData.asset.name}</div>
          <div className="text-sm text-gray-500">
            {"Portfolio"}: {sourceData.portfolioCode}
          </div>
        </div>

        {/* Target Portfolio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {"Target Portfolio"}
          </label>
          {targetPortfolios.length === 0 ? (
            <p className="text-sm text-red-500">
              {"No other portfolios available"}
            </p>
          ) : (
            <select
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-purple-500 focus:border-purple-500"
            >
              {targetPortfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.code} - {portfolio.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Maintain Cash Balances */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="maintainCash"
            checked={maintainCash}
            onChange={(e) => setMaintainCash(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <div>
            <label
              htmlFor="maintainCash"
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              {"Maintain current cash balances"}
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              {
                "When enabled, compensating cash transactions will be created to keep cash balances unchanged in both portfolios"
              }
            </p>
          </div>
        </div>

        {/* Move Summary */}
        {selectedPortfolioId && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-sm text-gray-600 mb-2">{"Move Summary"}</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>{"Asset"}:</span>
                <span className="font-medium">
                  {assetCode} ({sourceData.asset.name})
                </span>
              </div>
              <div className="flex justify-between">
                <span>{"From"}:</span>
                <span className="font-medium">{sourceData.portfolioCode}</span>
              </div>
              <div className="flex justify-between">
                <span>{"To"}:</span>
                <span className="font-medium">{selectedTarget?.code}</span>
              </div>
              {maintainCash && (
                <div className="text-xs text-purple-600 mt-1">
                  {"Cash balances will be preserved in both portfolios"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        <Dialog.ErrorAlert message={submitError} />
      </div>
    </Dialog>
  )
}

export default MovePositionDialog
