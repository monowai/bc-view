import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { Portfolio } from "types/beancounter"

interface ConsolidatePortfoliosDialogProps {
  portfolios: Portfolio[]
  onClose: () => void
  onComplete: () => void | Promise<void>
}

type Step = "select" | "confirm"

/**
 * Wizard to downgrade from "master" (several portfolios) towards zen (one):
 * pick a source portfolio to fold into a target, review, then merge. The
 * backend reassigns every transaction from source→target and deletes the
 * emptied source in one atomic op (POST /portfolios/{source}/merge/{target}).
 */
const ConsolidatePortfoliosDialog: React.FC<
  ConsolidatePortfoliosDialogProps
> = ({ portfolios, onClose, onComplete }) => {
  const [step, setStep] = useState<Step>("select")
  // Source = the portfolio that gets emptied and deleted; target keeps everything.
  const [sourceId, setSourceId] = useState<string>("")
  const [targetId, setTargetId] = useState<string>("")

  // Shared submit state machine: success is only flagged after the whole
  // operation (POST + parent refresh) resolves, the auto-close is unmount-safe,
  // and a failed merge surfaces an error instead of a stuck modal.
  const { isSubmitting, submitError, submitSuccess, handleSubmit, setError } =
    useDialogSubmit({
      onSuccess: onClose,
      autoCloseDelay: 800,
      fallbackError: "Failed to consolidate",
    })

  const byId = (id: string): Portfolio | undefined =>
    portfolios.find((p) => p.id === id)
  const source = byId(sourceId)
  const target = byId(targetId)

  // Both portfolios must still exist (the list can change under us) and differ.
  const canReview = !!source && !!target && sourceId !== targetId

  const handleMerge = async (): Promise<void> => {
    if (!canReview) return
    await handleSubmit(async () => {
      const response = await fetch(
        `/api/portfolios/${sourceId}/merge/${targetId}`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(
          err.detail ||
            err.message ||
            err.error ||
            `Failed: ${response.statusText}`,
        )
      }
      // Only flag success once the parent's portfolio list has refreshed.
      await onComplete()
    })
  }

  // Selecting a different pairing invalidates any prior failure message.
  const pickSource = (id: string): void => {
    setSourceId(id)
    if (id === targetId) setTargetId("")
    setError(null)
  }
  const pickTarget = (id: string): void => {
    setTargetId(id)
    setError(null)
  }
  const backToSelect = (): void => {
    setStep("select")
    setError(null)
  }

  const footer =
    step === "select" ? (
      <>
        <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
        <Dialog.SubmitButton
          onClick={() => setStep("confirm")}
          label={"Review"}
          disabled={!canReview}
        />
      </>
    ) : (
      <>
        <Dialog.CancelButton onClick={backToSelect} label={"Back"} />
        {submitSuccess ? (
          <button
            type="button"
            className="px-4 py-2 rounded text-white bg-green-600"
            disabled
          >
            <span className="flex items-center">
              <i className="fas fa-check mr-2"></i>
              {"Consolidated"}
            </span>
          </button>
        ) : (
          <Dialog.SubmitButton
            onClick={handleMerge}
            label={"Consolidate"}
            loadingLabel={"Consolidating..."}
            isSubmitting={isSubmitting}
            disabled={!canReview}
          />
        )}
      </>
    )

  return (
    <Dialog
      title={"Consolidate Portfolios"}
      onClose={onClose}
      maxWidth={"lg"}
      footer={footer}
    >
      {step === "select" ? (
        <>
          <p className="text-sm text-gray-500">
            {
              "Move everything from one portfolio into another, then remove the empty one. Useful when you only want to manage a single portfolio."
            }
          </p>

          <div>
            <label
              htmlFor="consolidate-source"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Move everything from"}
            </label>
            <select
              id="consolidate-source"
              value={sourceId}
              onChange={(e) => pickSource(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white"
            >
              <option value="">{"Select a portfolio to remove..."}</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="consolidate-target"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Into"}
            </label>
            <select
              id="consolidate-target"
              value={targetId}
              onChange={(e) => pickTarget(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white"
            >
              <option value="">{"Select the portfolio to keep..."}</option>
              {portfolios
                .filter((p) => p.id !== sourceId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
            </select>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <i className="fas fa-triangle-exclamation text-amber-500"></i>
            {"Confirm consolidation"}
          </div>
          <p className="text-sm text-gray-700">
            {"Every transaction in "}
            <span className="font-semibold">{source?.code}</span>
            {" will move into "}
            <span className="font-semibold">{target?.code}</span>
            {", then "}
            <span className="font-semibold">{source?.code}</span>
            {" will be permanently deleted."}
          </p>
          <p className="text-xs text-gray-500">
            {"This can't be undone. Holdings for the same asset combine in "}
            {target?.code}
            {"."}
          </p>
        </div>
      )}

      <Dialog.ErrorAlert message={submitError} />
    </Dialog>
  )
}

export default ConsolidatePortfoliosDialog
