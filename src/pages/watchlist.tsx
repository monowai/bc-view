import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { errorOut } from "@components/errors/ErrorOut"
import { rootLoader } from "@components/ui/PageLoader"
import EmptyState from "@components/ui/EmptyState"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import Alert from "@components/ui/Alert"
import WatchlistItemsTable from "@components/features/watchlists/WatchlistItemsTable"
import EditWatchlistItemDialog from "@components/features/watchlists/EditWatchlistItemDialog"
import AddToWatchlistDialog from "@components/features/watchlists/AddToWatchlistDialog"
import AssetReviewPopup from "@components/features/assets/AssetReviewPopup"
import { useWatchlist } from "@hooks/useWatchlist"
import {
  removeWatchlistItem,
  updateWatchlistItem,
} from "@lib/watchlists/watchlistApi"
import {
  buildNewsAsset,
  getPositionDisplayName,
  NewsAssetRef,
} from "@lib/assets/assetUtils"
import { WatchlistItem, WatchlistItemUpdate } from "types/beancounter"

export default withPageAuthRequired(
  function WatchlistPage(): React.ReactElement {
    const { items, error, mutate } = useWatchlist()
    // Captured at click time, so a background refresh cannot re-key an open review.
    const [reviewing, setReviewing] = useState<NewsAssetRef | null>(null)
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<WatchlistItem | null>(null)
    const [removing, setRemoving] = useState<WatchlistItem | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    // A failed background refresh keeps the last good copy on screen.
    if (error && !items) return errorOut("Error retrieving watchlist", error)
    if (!items) return rootLoader("Loading...")

    const handleEdit = async (update: WatchlistItemUpdate): Promise<void> => {
      if (!editing) return
      await updateWatchlistItem(editing.id, update)
      setActionError(null)
      setEditing(null)
      // Revalidate in the background: the write already succeeded.
      void mutate()
    }

    const handleRemove = async (): Promise<void> => {
      if (!removing) return
      const item = removing
      setRemoving(null)
      setActionError(null)
      try {
        await removeWatchlistItem(item.id)
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Remove failed")
        return
      }
      void mutate()
    }

    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{"Watchlist"}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {"Assets you are tracking but don't necessarily hold"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              <i aria-hidden="true" className="fas fa-plus"></i>
              {"Add Asset"}
            </button>
          </div>
        </div>

        {actionError && (
          <Alert variant="error" className="mb-4">
            {actionError}
          </Alert>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon="fas fa-eye"
            title="Nothing on your watchlist yet"
            description="Add an asset here, from Asset Lookup, or from a holding's actions menu to track its price against your target and the price when you added it."
          />
        ) : (
          <div className="md:overflow-x-auto md:rounded-lg md:border md:border-gray-200 md:bg-white">
            <WatchlistItemsTable
              items={items}
              onEdit={setEditing}
              onRemove={setRemoving}
              onReview={(item) => setReviewing(buildNewsAsset(item.asset))}
            />
          </div>
        )}

        {reviewing && (
          <AssetReviewPopup
            key={`${reviewing.ticker}|${reviewing.market}`}
            ticker={reviewing.ticker}
            market={reviewing.market}
            assetName={reviewing.assetName}
            onClose={() => setReviewing(null)}
          />
        )}
        {adding && (
          <AddToWatchlistDialog
            onAdded={() => setActionError(null)}
            onClose={() => setAdding(false)}
          />
        )}
        {editing && (
          <EditWatchlistItemDialog
            item={editing}
            onSubmit={handleEdit}
            onClose={() => setEditing(null)}
          />
        )}
        {removing && (
          <ConfirmDialog
            title="Remove from Watchlist"
            message={`Remove ${getPositionDisplayName(removing.asset)} from your watchlist?`}
            confirmLabel="Remove"
            variant="red"
            onConfirm={handleRemove}
            onCancel={() => setRemoving(null)}
          />
        )}
      </div>
    )
  },
)
