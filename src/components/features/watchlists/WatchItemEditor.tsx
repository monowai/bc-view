import React, { useState } from "react"
import { mutate } from "swr"
import { WatchlistItem, WatchlistItemUpdate } from "types/beancounter"
import RowSafePortal from "@components/ui/RowSafePortal"
import WatchItemRemover from "@components/features/watchlists/WatchItemRemover"
import EditWatchlistItemDialog from "@components/features/watchlists/EditWatchlistItemDialog"
import { updateWatchlistItem } from "@utils/api/client/watchlist"
import { watchlistKey } from "@utils/api/fetchHelper"
import { getPositionDisplayName } from "@lib/assets/assetUtils"

interface WatchItemEditorProps {
  item: WatchlistItem
  onClose: () => void
}

/**
 * Edit or remove a watchlist item from outside the watchlist page, such as a
 * holding row. Remove asks first; cancelling returns to the edit.
 */
export default function WatchItemEditor({
  item,
  onClose,
}: WatchItemEditorProps): React.ReactElement {
  const [removing, setRemoving] = useState(false)
  const handleSubmit = async (update: WatchlistItemUpdate): Promise<void> => {
    await updateWatchlistItem(item.id, update)
    onClose()
    // Revalidate in the background: the write already succeeded.
    void mutate(watchlistKey)
  }
  if (removing) {
    return (
      <WatchItemRemover
        item={item}
        label={getPositionDisplayName(item.asset)}
        onClose={() => setRemoving(false)}
        onRemoved={onClose}
      />
    )
  }
  return (
    <RowSafePortal>
      <EditWatchlistItemDialog
        item={item}
        onSubmit={handleSubmit}
        onRemove={() => setRemoving(true)}
        onClose={onClose}
      />
    </RowSafePortal>
  )
}
