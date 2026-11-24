import React from "react"
import { mutate } from "swr"
import { WatchlistItem, WatchlistItemUpdate } from "types/beancounter"
import RowSafePortal from "@components/ui/RowSafePortal"
import EditWatchlistItemDialog from "@components/features/watchlists/EditWatchlistItemDialog"
import { updateWatchlistItem } from "@utils/api/client/watchlist"
import { watchlistKey } from "@utils/api/fetchHelper"

interface WatchItemEditorProps {
  item: WatchlistItem
  onClose: () => void
}

/** Edit a watchlist item from outside the watchlist page, such as a holding row. */
export default function WatchItemEditor({
  item,
  onClose,
}: WatchItemEditorProps): React.ReactElement {
  const handleSubmit = async (update: WatchlistItemUpdate): Promise<void> => {
    await updateWatchlistItem(item.id, update)
    onClose()
    // Revalidate in the background: the write already succeeded.
    void mutate(watchlistKey)
  }
  return (
    <RowSafePortal>
      <EditWatchlistItemDialog
        item={item}
        onSubmit={handleSubmit}
        onClose={onClose}
      />
    </RowSafePortal>
  )
}
