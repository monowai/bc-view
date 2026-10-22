import React, { useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import useSWR from "swr"
import Link from "next/link"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { rootLoader } from "@components/ui/PageLoader"
import { usePermissions } from "@hooks/usePermissions"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { readServerMessage } from "@utils/api/client/request"
import { formatDate } from "@lib/formatters"
import { AdminUser } from "types/admin"
import { AgentQuotaOverview, AgentQuotaStatus } from "types/agent"

const USERS_URL = "/api/admin/users"
const OVERVIEW_URL = "/api/admin/ai-quota"

type AllowanceMode = "default" | "custom" | "unlimited" | "disabled"

interface Allowance {
  mode: AllowanceMode
  /** Only meaningful when mode is "custom". */
  limit: number
}

/**
 * Who the server says this user is: an absent entry is on the default with
 * nothing used this week (the overview lists only users with use or an
 * override).
 */
function statusFor(
  overview: AgentQuotaOverview,
  userId: string,
): AgentQuotaStatus {
  return (
    overview.users[userId] ?? {
      limit: overview.defaultLimit,
      used: 0,
      remaining: overview.defaultLimit,
      resetAt: null,
      contact: "",
      override: false,
      unlimited: false,
      verified: true,
    }
  )
}

function allowanceOf(status: AgentQuotaStatus): Allowance {
  if (!status.override) return { mode: "default", limit: status.limit }
  if (status.unlimited) return { mode: "unlimited", limit: status.limit }
  if (status.limit === 0) return { mode: "disabled", limit: 0 }
  return { mode: "custom", limit: status.limit }
}

function weekUseText(status: AgentQuotaStatus): string {
  if (status.unlimited) return "Unlimited"
  if (status.override && status.limit === 0) return "Disabled"
  return `${status.used} of ${status.limit} used`
}

function parseLimit(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= 1 ? n : null
}

/**
 * The request that applies an allowance, per the svc-agent contract. A custom
 * mode needs its parsed limit; there is no fallback that could disable a user.
 */
function saveRequest(mode: AllowanceMode, limit: number | null): RequestInit {
  if (mode === "default") return { method: "DELETE" }
  if (mode === "custom" && limit === null) {
    throw new Error("A custom allowance needs a weekly limit")
  }
  const body =
    mode === "unlimited"
      ? { unlimited: true }
      : { weeklyLimit: mode === "disabled" ? 0 : limit }
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

async function errorText(response: Response): Promise<string> {
  return (
    (await readServerMessage(response)) ??
    `Failed to save (HTTP ${response.status})`
  )
}

const inputClass =
  "border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

interface QuotaRowProps {
  user: AdminUser
  status: AgentQuotaStatus
  defaultLimit: number
  onSaved: () => Promise<unknown>
}

function QuotaRow({
  user,
  status,
  defaultLimit,
  onSaved,
}: QuotaRowProps): React.ReactElement {
  const current = allowanceOf(status)
  const [mode, setMode] = useState<AllowanceMode>(current.mode)
  const [limitText, setLimitText] = useState<string>(
    String(current.mode === "custom" ? current.limit : defaultLimit),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const customLimit = parseLimit(limitText)
  const changed =
    mode !== current.mode ||
    (mode === "custom" && customLimit !== current.limit)
  const valid = mode !== "custom" || customLimit !== null
  const canSave = changed && valid && !isSaving

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/ai-quota/${encodeURIComponent(user.id)}`,
        saveRequest(mode, customLimit),
      )
      if (response.ok) {
        await onSaved()
      } else {
        setError(await errorText(response))
      }
    } catch {
      setError("Failed to save allowance")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <tr data-testid={`quota-row-${user.id}`} className="hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-900">
        <span className="font-medium">{user.email}</span>
        {!user.active && (
          <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
            {"Inactive"}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {formatDate(user.since)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {user.lastSeen ? formatDate(user.lastSeen) : "—"}
      </td>
      <td
        data-testid="quota-use"
        className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap"
      >
        {weekUseText(status)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            aria-label={`Allowance for ${user.email}`}
            value={mode}
            onChange={(e) => setMode(e.target.value as AllowanceMode)}
            className={inputClass}
          >
            <option value="default">{`Default (${defaultLimit})`}</option>
            <option value="custom">{"Custom"}</option>
            <option value="unlimited">{"Unlimited"}</option>
            <option value="disabled">{"Disabled"}</option>
          </select>
          {mode === "custom" && (
            <input
              type="number"
              min="1"
              step="1"
              aria-label={`Weekly limit for ${user.email}`}
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              className={`${inputClass} w-20`}
            />
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            aria-label={`Save allowance for ${user.email}`}
            className={`px-3 py-1 text-sm text-white rounded-lg transition-colors ${
              canSave
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {isSaving ? <Spinner label={"Saving..."} /> : "Save"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-600 mt-1">
            {error}
          </p>
        )}
      </td>
    </tr>
  )
}

export default withPageAuthRequired(
  function AiQuotaAdmin(): React.ReactElement {
    const { admin: isAdmin, isLoading: isAdminLoading } = usePermissions()
    const [filter, setFilter] = useState("")

    const canLoad = isAdmin && !isAdminLoading
    const users = useSWR<{ data: AdminUser[] }>(
      canLoad ? USERS_URL : null,
      simpleFetcher(USERS_URL),
    )
    const overview = useSWR<{ data: AgentQuotaOverview }>(
      canLoad ? OVERVIEW_URL : null,
      simpleFetcher(OVERVIEW_URL),
    )

    const visibleUsers = useMemo(() => {
      const all = users.data?.data ?? []
      const needle = filter.trim().toLowerCase()
      return needle
        ? all.filter((u) => u.email.toLowerCase().includes(needle))
        : all
    }, [users.data, filter])

    if (isAdminLoading) {
      return rootLoader("Loading...")
    }

    if (!isAdmin) {
      return (
        <div className="max-w-4xl mx-auto py-12 px-4">
          <Alert variant="error" className="p-6 text-center">
            <i className="fas fa-lock text-4xl text-red-400 mb-4"></i>
            <h1 className="text-xl font-semibold text-red-700 mb-2">
              {"Access Denied"}
            </h1>
            <p className="text-red-600">
              {"You do not have permission to access the admin area."}
            </p>
            <Link
              href="/portfolios"
              className="inline-block mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              {"Return to Portfolios"}
            </Link>
          </Alert>
        </div>
      )
    }

    const quota = overview.data?.data
    const loadError = users.error || overview.error
    const isLoading = !loadError && (!users.data || !quota)

    return (
      <div className="max-w-5xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{"AI Reviews"}</h1>
          <p className="text-gray-600 mt-1">
            {"See each user's AI use this week and set their weekly allowance."}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            <i className="fas fa-info-circle mr-1" aria-hidden="true"></i>
            {
              "An Unlimited allowance still needs a confirmed email address; until the user confirms it, only cached Asset Reviews are served."
            }
          </p>
        </div>

        {loadError && (
          <Alert variant="error" className="mb-4">
            {"Failed to load users or AI allowances."}
          </Alert>
        )}

        <div className="mb-4">
          <label htmlFor="quota-filter" className="sr-only">
            {"Filter by email"}
          </label>
          <input
            id="quota-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by email"
            className="w-full md:w-80 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <Spinner label={"Loading..."} size="lg" />
            </div>
          ) : loadError ? null : !quota || visibleUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-users text-4xl mb-3"></i>
              <p>{"No users found"}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                    {"Email"}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                    {"Member since"}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                    {"Last seen"}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                    {"This week"}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                    {"Weekly allowance"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibleUsers.map((user) => (
                  <QuotaRow
                    key={user.id}
                    user={user}
                    status={statusFor(quota, user.id)}
                    defaultLimit={quota.defaultLimit}
                    onSaved={() => overview.mutate()}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  },
)
