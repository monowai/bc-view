import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Alert from "@components/ui/Alert"
import Head from "next/head"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import type {
  PortfolioShare,
  ResourceShare,
  ShareStatus,
} from "types/beancounter"

function statusBadge(status: ShareStatus): React.ReactElement {
  const styles: Record<ShareStatus, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    PENDING_CLIENT_INVITE: "bg-amber-100 text-amber-700",
    PENDING_ADVISER_REQUEST: "bg-amber-100 text-amber-700",
    REVOKED: "bg-gray-200 text-gray-600",
  }
  const labels: Record<ShareStatus, string> = {
    ACTIVE: "Active",
    PENDING_CLIENT_INVITE: "Invite sent",
    PENDING_ADVISER_REQUEST: "Pending",
    REVOKED: "Revoked",
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function SharesPage(): React.ReactElement {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const portfolios = useSwr<{ data: PortfolioShare[] }>(
    "/api/shares/granted",
    simpleFetcher("/api/shares/granted"),
  )
  const plans = useSwr<{ data: ResourceShare[] }>(
    "/api/resource-shares/granted/INDEPENDENCE_PLAN",
    simpleFetcher("/api/resource-shares/granted/INDEPENDENCE_PLAN"),
  )
  const models = useSwr<{ data: ResourceShare[] }>(
    "/api/resource-shares/granted/REBALANCE_MODEL",
    simpleFetcher("/api/resource-shares/granted/REBALANCE_MODEL"),
  )

  const revokePortfolioShare = async (id: string): Promise<void> => {
    if (
      !window.confirm(
        "Revoke this share? The recipient loses access immediately.",
      )
    )
      return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/shares/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Revoke failed (${res.status})`)
      }
      await portfolios.mutate()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const revokeResourceShare = async (
    id: string,
    refetch: () => Promise<unknown>,
  ): Promise<void> => {
    if (
      !window.confirm(
        "Revoke this share? The recipient loses access immediately.",
      )
    )
      return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/resource-shares/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Revoke failed (${res.status})`)
      }
      await refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const portfolioShares = portfolios.data?.data ?? []
  const planShares = plans.data?.data ?? []
  const modelShares = models.data?.data ?? []

  return (
    <>
      <Head>
        <title>Shares | Holdsworth</title>
      </Head>
      <div className="max-w-4xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {"Shares I've granted"}
          </h1>
          <p className="text-sm text-gray-600">
            {
              "Review and revoke access you've shared with advisers or other users. Revoking is immediate — the recipient loses access on their next request."
            }
          </p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <Section
          title="Portfolios"
          icon="fa-briefcase"
          loading={portfolios.isLoading}
          shares={portfolioShares.map((s) => ({
            id: s.id,
            label: s.portfolio?.name ?? s.portfolio?.code ?? "(unknown)",
            sub: s.portfolio?.code,
            recipient:
              s.sharedWith?.email ?? s.targetUser?.email ?? "(pending)",
            accessLevel: s.accessLevel,
            status: s.status,
          }))}
          busyId={busyId}
          onRevoke={revokePortfolioShare}
        />

        <Section
          title="Independence Plans"
          icon="fa-chart-line"
          loading={plans.isLoading}
          shares={planShares.map((s) => ({
            id: s.id,
            label: s.resourceName ?? "(unnamed plan)",
            sub: undefined,
            recipient:
              s.sharedWith?.email ?? s.targetUser?.email ?? "(pending)",
            accessLevel: s.accessLevel,
            status: s.status,
          }))}
          busyId={busyId}
          onRevoke={(id) => revokeResourceShare(id, plans.mutate)}
        />

        <Section
          title="Rebalance Models"
          icon="fa-balance-scale"
          loading={models.isLoading}
          shares={modelShares.map((s) => ({
            id: s.id,
            label: s.resourceName ?? "(unnamed model)",
            sub: undefined,
            recipient:
              s.sharedWith?.email ?? s.targetUser?.email ?? "(pending)",
            accessLevel: s.accessLevel,
            status: s.status,
          }))}
          busyId={busyId}
          onRevoke={(id) => revokeResourceShare(id, models.mutate)}
        />
      </div>
    </>
  )
}

interface SectionRow {
  id: string
  label: string
  sub?: string
  recipient: string
  accessLevel: string
  status: ShareStatus
}

function Section({
  title,
  icon,
  loading,
  shares,
  busyId,
  onRevoke,
}: {
  title: string
  icon: string
  loading: boolean
  shares: SectionRow[]
  busyId: string | null
  onRevoke: (id: string) => void | Promise<void>
}): React.ReactElement {
  return (
    <section className="mb-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 bg-gray-50">
        <i className={`fas ${icon} text-gray-500`}></i>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="ml-auto text-xs text-gray-500">
          {loading
            ? "…"
            : `${shares.length} share${shares.length === 1 ? "" : "s"}`}
        </span>
      </header>
      {!loading && shares.length === 0 && (
        <p className="px-4 py-6 text-sm text-gray-500 text-center">
          {`No ${title.toLowerCase()} shared.`}
        </p>
      )}
      {shares.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">Resource</th>
              <th className="text-left px-4 py-2">Recipient</th>
              <th className="text-left px-4 py-2">Access</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-4 py-2">
                  <div className="text-gray-900">{s.label}</div>
                  {s.sub && (
                    <div className="text-xs text-gray-500">{s.sub}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-700">{s.recipient}</td>
                <td className="px-4 py-2 text-gray-700">{s.accessLevel}</td>
                <td className="px-4 py-2">{statusBadge(s.status)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onRevoke(s.id)}
                    disabled={busyId === s.id}
                    className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:text-gray-400"
                  >
                    {busyId === s.id ? "Revoking…" : "Revoke"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default withPageAuthRequired(SharesPage)
