import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { errorOut } from "@components/errors/ErrorOut"
import { rootLoader } from "@components/ui/PageLoader"
import EmptyState from "@components/ui/EmptyState"
import WatchlistFormDialog from "@components/features/watchlists/WatchlistFormDialog"
import { useWatchlists } from "@hooks/useWatchlists"
import { createWatchlist } from "@lib/watchlists/watchlistApi"
import { WatchlistRequest } from "types/beancounter"

export default withPageAuthRequired(function Watchlists(): React.ReactElement {
  const router = useRouter()
  const { watchlists, error, isLoading, mutate } = useWatchlists()
  const [creating, setCreating] = useState(false)

  const handleCreate = async (request: WatchlistRequest): Promise<void> => {
    const created = await createWatchlist(request)
    setCreating(false)
    router.push(`/watchlists/${created.id}`)
    // Background refresh: a failed GET must not read as a failed create.
    void mutate()
  }

  if (error) return errorOut("Error retrieving watchlists", error)
  if (isLoading) return rootLoader("Loading...")

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{"Watchlists"}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {"Assets you are tracking but don't necessarily hold"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          <i aria-hidden="true" className="fas fa-plus"></i>
          {"New Watchlist"}
        </button>
      </div>

      {watchlists.length === 0 ? (
        <EmptyState
          icon="fas fa-eye"
          title="No watchlists yet"
          description="Create one, then add assets from Asset Lookup or a holding's actions menu."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  {"Code"}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  {"Name"}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                  {"Assets"}
                </th>
              </tr>
            </thead>
            <tbody>
              {watchlists.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/watchlists/${w.id}`}
                      className="font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {w.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{w.name}</td>
                  <td
                    className="px-4 py-2 text-right tabular-nums text-gray-700"
                    data-testid={`item-count-${w.id}`}
                  >
                    {w.itemCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <WatchlistFormDialog
          title="New Watchlist"
          submitLabel="Create"
          onSubmit={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
})
