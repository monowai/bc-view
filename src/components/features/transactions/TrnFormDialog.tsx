import React, { useEffect, useRef, useState } from "react"
import Dialog from "@components/ui/Dialog"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { copyToClipboard } from "@lib/trns/formUtils"

type CopyStatus = "idle" | "success" | "error"

/** How long the Copy icon shows whether the copy worked. */
const COPY_FEEDBACK_MS = 2000

const COPY_STATE: Record<
  CopyStatus,
  { title: string; icon: string; tone: string }
> = {
  idle: {
    title: "Copy",
    icon: "fa-copy",
    tone: "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
  },
  success: {
    title: "Copied",
    icon: "fa-check",
    tone: "text-green-700 bg-green-50",
  },
  error: {
    title: "Copy failed",
    icon: "fa-xmark",
    tone: "text-red-600 bg-red-50",
  },
}

/** Header icon that copies the transaction as a CSV row and says whether it worked. */
function CopyRowButton({
  getRow,
}: {
  getRow: () => string
}): React.ReactElement {
  const [status, setStatus] = useState<CopyStatus>("idle")
  const state = COPY_STATE[status]
  // One feedback timer: a fresh copy restarts it, closing the dialog drops it.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async (): Promise<void> => {
    const ok = await copyToClipboard(getRow())
    setStatus(ok ? "success" : "error")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus("idle"), COPY_FEEDBACK_MS)
  }
  return (
    <HeaderIconButton
      title={state.title}
      icon={state.icon}
      tone={state.tone}
      onClick={() => void copy()}
    />
  )
}

/** A round icon button for the dialog header. */
export function HeaderIconButton({
  title,
  icon,
  tone = "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
  onClick,
}: {
  title: string
  icon: string
  tone?: string
  onClick?: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${tone}`}
    >
      <i className={`fas ${icon} text-sm`} aria-hidden="true"></i>
    </button>
  )
}

interface TrnFormDialogProps {
  /** The dialog's name: what this transaction does. */
  title: React.ReactNode
  /** Context under the title, such as the portfolio. */
  subtitle?: React.ReactNode
  /** Sits opposite the subtitle, such as the Proposed/Settled switch. */
  status?: React.ReactNode
  /** Fixed controls under the context line: tabs or a type picker. */
  tabs?: React.ReactNode
  /** Header icons beside Copy, such as Delete. */
  actions?: React.ReactNode
  /** Builds the CSV row for the Copy icon; no icon without it. */
  copyRow?: () => string
  /** Changes not yet saved: closing asks first. */
  isDirty: boolean
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
  submittingLabel?: string
  isSubmitting?: boolean
  submitDisabled?: boolean
  /** Reads the transaction back beside the buttons. */
  summary?: React.ReactNode
  children: React.ReactNode
}

/**
 * The shell every transaction entry form shares: the app's Dialog with a
 * context line, a fixed tab band, a read-back of the transaction beside the
 * buttons, and a guard that asks before throwing changes away.
 */
export default function TrnFormDialog({
  title,
  subtitle,
  status,
  tabs,
  actions,
  copyRow,
  isDirty,
  onClose,
  onSubmit,
  submitLabel,
  submittingLabel,
  isSubmitting = false,
  submitDisabled = false,
  summary,
  children,
}: TrnFormDialogProps): React.ReactElement {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const requestClose = (): void => {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  const hasContext = subtitle || status
  return (
    <>
      <Dialog
        title={title}
        onClose={requestClose}
        maxWidth="lg"
        scrollable
        actions={
          copyRow || actions ? (
            <>
              {copyRow && <CopyRowButton getRow={copyRow} />}
              {actions}
            </>
          ) : undefined
        }
        subheader={
          hasContext || tabs ? (
            <>
              {hasContext && (
                <div className="flex min-h-10 items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-xs text-gray-500">
                    {subtitle}
                  </span>
                  {status}
                </div>
              )}
              {tabs}
            </>
          ) : undefined
        }
        footer={
          <>
            {/* On a phone the read-back takes its own line, so the two
                buttons stay together beneath it. */}
            {summary ? (
              <div className="mr-auto w-full min-w-0 sm:w-auto">{summary}</div>
            ) : (
              <span className="mr-auto" />
            )}
            <Dialog.CancelButton onClick={requestClose} />
            <Dialog.SubmitButton
              onClick={onSubmit}
              label={submitLabel}
              loadingLabel={submittingLabel}
              isSubmitting={isSubmitting}
              disabled={submitDisabled}
              variant="blue"
            />
          </>
        }
      >
        {children}
      </Dialog>
      {confirmDiscard && (
        <ConfirmDialog
          title="Unsaved changes"
          message="Close without saving? What you entered will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          variant="amber"
          zClass="z-[60]"
          onConfirm={() => {
            setConfirmDiscard(false)
            onClose()
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </>
  )
}
