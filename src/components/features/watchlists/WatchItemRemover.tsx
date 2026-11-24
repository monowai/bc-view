import React, { useState } from "react"
import { mutate } from "swr"
import { WatchlistItem } from "types/beancounter"
import Dialog from "@components/ui/Dialog"
import RowSafePortal from "@components/ui/RowSafePortal"
import { removeWatchlistItem } from "@utils/api/client/watchlist"
import { watchlistKey } from "@utils/api/fetchHelper"

interface WatchItemRemoverProps {
  item: WatchlistItem
  /** What the reader sees in the question, e.g. the display code. */
  label: string
  onClose: () => void
}

/**
 * Confirm and remove a watchlist item from outside the watchlist page, such as
 * a holding row. A failed remove keeps the dialog open with the reason.
 */
export default function WatchItemRemover({
  item,
  label,
  onClose,
}: WatchItemRemoverProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleRemove = async (): Promise<void> => {
    setError(null)
    setSubmitting(true)
    try {
      await removeWatchlistItem(item.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed")
      setSubmitting(false)
      return
    }
    onClose()
    // Revalidate in the background: the delete already succeeded.
    void mutate(watchlistKey)
  }

  return (
    <RowSafePortal>
      <Dialog
        title="Remove from Watchlist"
        onClose={onClose}
        maxWidth="sm"
        footer={
          <>
            <Dialog.CancelButton onClick={onClose} />
            <Dialog.SubmitButton
              onClick={handleRemove}
              label="Remove"
              loadingLabel="Removing..."
              isSubmitting={submitting}
              variant="red"
            />
          </>
        }
      >
        <p className="text-gray-600">{`Remove ${label} from your watchlist?`}</p>
        <Dialog.ErrorAlert message={error} />
      </Dialog>
    </RowSafePortal>
  )
}
