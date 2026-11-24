import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { errorOut } from "@components/errors/ErrorOut"
import { rootLoader } from "@components/ui/PageLoader"
import EmptyState from "@components/ui/EmptyState"
import WatchlistItemsTable from "@components/features/watchlists/WatchlistItemsTable"
import EditWatchlistItemDialog from "@components/features/watchlists/EditWatchlistItemDialog"
import AddToWatchlistDialog from "@components/features/watchlists/AddToWatchlistDialog"
import WatchItemRemover from "@components/features/watchlists/WatchItemRemover"
import AssetReviewPopup from "@components/features/assets/AssetReviewPopup"
import AssetChart from "@components/features/assets/AssetChart"
import { useNewsAsset } from "@components/features/assets/useNewsAsset"
import WatchlistAlertsPanel from "@components/features/watchlists/WatchlistAlertsPanel"
import { useWatchlist } from "@hooks/useWatchlist"
import { useWatchlistAlerts } from "@hooks/useWatchlistAlerts"
import { updateWatchlistItem } from "@utils/api/client/watchlist"
import {
  buildNewsAsset,
  getPositionDisplayName,
  NewsAssetRef,
} from "@lib/assets/assetUtils"
import { WatchlistItem, WatchlistItemUpdate } from "types/beancounter"
import { currencySymbolFor } from "@lib/formatters"

export default withPageAuthRequired(
  function WatchlistPage(): React.ReactElement {
    const { items, error, mutate } = useWatchlist()
    const { alerts, setAlerts } = useWatchlistAlerts()
    // Captured at click time, so a background refresh cannot re-key an open review.
    const [reviewing, setReviewing] = useState<NewsAssetRef | null>(null)
    const { popup: newsPopup, showNews } = useNewsAsset()
    const [charting, setCharting] = useState<WatchlistItem | null>(null)
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<WatchlistItem | null>(null)
    const [removing, setRemoving] = useState<WatchlistItem | null>(null)

    // A failed background refresh keeps the last good copy on screen.
    if (error && !items) return errorOut("Error retrieving watchlist", error)
    if (!items) return rootLoader("Loading...")

    const handleEdit = async (update: WatchlistItemUpdate): Promise<void> => {
      if (!editing) return
      await updateWatchlistItem(editing.id, update)
      setEditing(null)
      // Revalidate in the background: the write already succeeded.
      void mutate()
    }

    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{"Watchlist"}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {"Assets you are tracking but don't necessarily hold"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <i aria-hidden="true" className="fas fa-plus"></i>
              {"Add Asset"}
            </button>
          </div>
        </div>

        {alerts && (
          <WatchlistAlertsPanel
            alerts={alerts}
            onDismissed={(remaining) => {
              setAlerts(remaining)
              // targetHitOn on the items is the backend's to re-state.
              void mutate()
            }}
          />
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
              onChart={setCharting}
              onNews={(item) => showNews(item.asset)}
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
        {newsPopup}
        {charting && (
          <AssetChart
            asset={charting.asset}
            currencySymbol={currencySymbolFor(
              charting.currency.code,
              charting.currency.symbol,
            )}
            onClose={() => setCharting(null)}
          />
        )}
        {adding && <AddToWatchlistDialog onClose={() => setAdding(false)} />}
        {editing && (
          <EditWatchlistItemDialog
            item={editing}
            onSubmit={handleEdit}
            onClose={() => setEditing(null)}
          />
        )}
        {removing && (
          <WatchItemRemover
            item={removing}
            label={getPositionDisplayName(removing.asset)}
            onClose={() => setRemoving(null)}
          />
        )}
      </div>
    )
  },
)
