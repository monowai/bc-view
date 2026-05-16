import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { rootLoader } from "@components/ui/PageLoader"
import { useIsAdmin } from "@hooks/useIsAdmin"
import useSWR from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

interface EntityCount {
  entity: string
  count: number
}

interface EntityCountsResponse {
  service: string
  counts: EntityCount[]
  breakdowns: Record<string, EntityCount[]>
  fetchedAt: string
}

const BREAKDOWN_LABELS: Record<string, string> = {
  "asset.count.by_market": "Assets by Market",
  "marketdata.count.by_market": "Market Data by Market",
  "transaction.count.by_type": "Transactions by Type",
  "news.count.by_source": "News by Source",
}

function formatCount(n: number): string {
  return n.toLocaleString()
}

function CountTile({
  label,
  value,
}: {
  label: string
  value: number
}): React.ReactElement {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">
        {formatCount(value)}
      </div>
    </div>
  )
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string
  rows: EntityCount[]
}): React.ReactElement | null {
  if (!rows?.length) return null
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((r) => (
              <tr
                key={r.entity}
                className="border-b last:border-0 border-gray-100"
              >
                <td className="px-4 py-2 text-gray-700">{r.entity}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-900">
                  {formatCount(r.count)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export default withPageAuthRequired(function MetricsPage(): React.ReactElement {
  const { isAdmin, isLoading } = useIsAdmin()
  const {
    data,
    error,
    isLoading: loadingData,
  } = useSWR<EntityCountsResponse>(
    isAdmin ? "/api/admin/metrics/entity-counts" : null,
    simpleFetcher,
    { refreshInterval: 60_000 },
  )

  if (isLoading) return rootLoader("Loading...")

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-red-700">Access Denied</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Service Metrics</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Live entity counts from <code>bc-data</code> Micrometer gauges.
          {data?.fetchedAt && (
            <span className="ml-2 text-gray-400">
              Fetched {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-700 text-sm">
            Failed to load metrics: {error.message}
          </p>
        </div>
      )}

      {loadingData && !data && (
        <div className="text-gray-500 text-sm">Loading metrics...</div>
      )}

      {data && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Entity counts
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {data.counts.map((c) => (
              <CountTile key={c.entity} label={c.entity} value={c.count} />
            ))}
          </div>

          {Object.keys(data.breakdowns).length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Breakdowns
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data.breakdowns).map(([key, rows]) => (
                  <BreakdownTable
                    key={key}
                    title={BREAKDOWN_LABELS[key] ?? key}
                    rows={rows}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
})
