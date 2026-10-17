import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { errorOut } from "@components/errors/ErrorOut"
import { rootLoader } from "@components/ui/PageLoader"
import EmptyState from "@components/ui/EmptyState"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import ActionMenu, { ActionMenuItem } from "@components/ui/ActionMenu"
import Alert from "@components/ui/Alert"
import WatchlistFormDialog from "@components/features/watchlists/WatchlistFormDialog"
import WatchlistItemsTable from "@components/features/watchlists/WatchlistItemsTable"
import EditWatchlistItemDialog from "@components/features/watchlists/EditWatchlistItemDialog"
import AddToWatchlistDialog from "@components/features/watchlists/AddToWatchlistDialog"
import { useWatchlist } from "@hooks/useWatchlists"
import {
  deleteWatchlist,
  removeWatchlistItem,
  updateWatchlist,
  updateWatchlistItem,
} from "@lib/watchlists/watchlistApi"
import { getPositionDisplayName } from "@lib/assets/assetUtils"
import {
  WatchlistItem,
  WatchlistItemUpdate,
  WatchlistRequest,
} from "types/beancounter"

export default withPageAuthRequired(
  function WatchlistDetail(): React.ReactElement {
    const router = useRouter()
    const id = typeof router.query.id === "string" ? router.query.id : undefined
    const { watchlist, error, isLoading, mutate } = useWatchlist(id)
    const [renaming, setRenaming] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState<WatchlistItem | null>(null)
    const [removing, setRemoving] = useState<WatchlistItem | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    if (error) return errorOut("Error retrieving watchlist", error)
    if (!id || isLoading || !watchlist) return rootLoader("Loading...")

    const handleRename = async (request: WatchlistRequest): Promise<void> => {
      await updateWatchlist(watchlist.id, request)
      await mutate()
      setRenaming(false)
    }

    const handleDelete = async (): Promise<void> => {
      setConfirmDelete(false)
      try {
        await deleteWatchlist(watchlist.id)
        router.push("/watchlists")
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Delete failed")
      }
    }

    const handleEdit = async (update: WatchlistItemUpdate): Promise<void> => {
      if (!editing) return
      await updateWatchlistItem(watchlist.id, editing.id, update)
      await mutate()
      setEditing(null)
    }

    const handleRemove = async (): Promise<void> => {
      if (!removing) return
      const item = removing
      setRemoving(null)
      try {
        await removeWatchlistItem(watchlist.id, item.id)
        await mutate()
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Remove failed")
      }
    }

    const menu: ActionMenuItem[] = [
      { label: "Rename", icon: "fa-pen", onSelect: () => setRenaming(true) },
      {
        label: "Delete",
        icon: "fa-trash",
        destructive: true,
        onSelect: () => setConfirmDelete(true),
      },
    ]

    return (
      <div className="container mx-auto px-4 py-6">
        <Link
          href="/watchlists"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          <i aria-hidden="true" className="fas fa-arrow-left mr-1"></i>
          {"Watchlists"}
        </Link>
        <div className="mt-2 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-bold text-gray-900">
              <span>{watchlist.name}</span>
              <span className="font-mono text-base font-medium text-gray-500">
                {watchlist.code}
              </span>
            </h1>
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
            <ActionMenu
              items={menu}
              label={`More actions for ${watchlist.code}`}
            />
          </div>
        </div>

        {actionError && (
          <Alert variant="error" className="mb-4">
            {actionError}
          </Alert>
        )}

        {watchlist.items.length === 0 ? (
          <EmptyState
            icon="fas fa-eye"
            title="Nothing on this watchlist yet"
            description="Add an asset to track its price against when you added it and your target."
          />
        ) : (
          <div className="md:overflow-x-auto md:rounded-lg md:border md:border-gray-200 md:bg-white">
            <WatchlistItemsTable
              items={watchlist.items}
              onEdit={setEditing}
              onRemove={setRemoving}
            />
          </div>
        )}

        {renaming && (
          <WatchlistFormDialog
            title="Rename Watchlist"
            submitLabel="Save"
            initial={{ code: watchlist.code, name: watchlist.name }}
            onSubmit={handleRename}
            onClose={() => setRenaming(false)}
          />
        )}
        {confirmDelete && (
          <ConfirmDialog
            title="Delete Watchlist"
            message={`Delete watchlist ${watchlist.code}? Its assets are not affected.`}
            confirmLabel="Delete"
            variant="red"
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
        {adding && (
          <AddToWatchlistDialog
            watchlistId={watchlist.id}
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
            message={`Remove ${getPositionDisplayName(removing.asset)} from ${watchlist.code}?`}
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
