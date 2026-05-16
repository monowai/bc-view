import React, { useState, useMemo } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { rootLoader } from "@components/ui/PageLoader"
import { useIsAdmin } from "@hooks/useIsAdmin"
import useSWR, { mutate } from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

const SERVICES = [
  "bc-data",
  "bc-position",
  "bc-event",
  "bc-retire",
  "bc-rebalance",
  "bc-agent",
] as const
type Service = (typeof SERVICES)[number]

const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "OFF"] as const
type Level = (typeof LEVELS)[number]

interface LoggerEntry {
  configuredLevel: string | null
  effectiveLevel: string
}

interface LoggersResponse {
  levels: string[]
  loggers: Record<string, LoggerEntry>
}

function levelBadgeClass(level: string): string {
  switch (level) {
    case "TRACE":
    case "DEBUG":
      return "bg-blue-100 text-blue-800"
    case "INFO":
      return "bg-green-100 text-green-800"
    case "WARN":
      return "bg-yellow-100 text-yellow-800"
    case "ERROR":
      return "bg-red-100 text-red-800"
    case "OFF":
      return "bg-gray-200 text-gray-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

export default withPageAuthRequired(function LoggersPage(): React.ReactElement {
  const { isAdmin, isLoading } = useIsAdmin()
  const [service, setService] = useState<Service>("bc-data")
  const [filter, setFilter] = useState("com.beancounter")
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)

  const swrKey = isAdmin ? `/api/admin/loggers/${service}` : null
  const {
    data,
    error,
    isLoading: loadingData,
  } = useSWR<LoggersResponse>(swrKey, swrKey ? simpleFetcher(swrKey) : null)

  const rows = useMemo(() => {
    if (!data?.loggers) return []
    return Object.entries(data.loggers)
      .filter(([name]) => name.toLowerCase().includes(filter.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [data, filter])

  async function setLevel(
    logger: string,
    configuredLevel: Level | null,
  ): Promise<void> {
    setSaving((prev) => {
      const next = new Set(prev)
      next.add(logger)
      return next
    })
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/loggers/${service}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logger, configuredLevel }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`)
      }
      await mutate(swrKey)
    } catch (e) {
      setSaveError(
        `Failed to set ${logger}: ${e instanceof Error ? e.message : String(e)}`,
      )
    } finally {
      setSaving((prev) => {
        const next = new Set(prev)
        next.delete(logger)
        return next
      })
    }
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Loggers</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Inspect and adjust log levels live. Changes take effect immediately
          and persist until the pod restarts.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            Service
          </label>
          <select
            value={service}
            onChange={(e) => setService(e.target.value as Service)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            Filter
          </label>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="com.beancounter"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="text-sm text-gray-500 self-center">
          {rows.length} match{rows.length === 1 ? "" : "es"}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700 text-sm">
          Failed to load loggers: {error.message}
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700 text-sm flex justify-between items-center">
          <span>{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            className="text-red-500 hover:text-red-700 ml-4"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {loadingData && !data && (
        <div className="text-gray-500 text-sm">Loading...</div>
      )}

      {data && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">
                  Logger
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 w-24">
                  Effective
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 w-40">
                  Set level
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, entry]) => (
                <tr
                  key={name}
                  className="border-b last:border-0 border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-2 text-gray-900 font-mono text-xs">
                    {name}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${levelBadgeClass(
                        entry.effectiveLevel,
                      )}`}
                    >
                      {entry.effectiveLevel}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={entry.configuredLevel ?? ""}
                      disabled={saving.has(name)}
                      onChange={(e) => {
                        const v = e.target.value
                        setLevel(name, v === "" ? null : (v as Level))
                      }}
                      className="border border-gray-300 rounded px-2 py-1 text-xs"
                    >
                      <option value="">(inherit)</option>
                      {LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})
