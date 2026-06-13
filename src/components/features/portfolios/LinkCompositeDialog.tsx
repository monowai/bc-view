import React, { useState } from "react"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import type { StandaloneCompositeConfig } from "@hooks/useStandaloneCompositeAssets"

interface PortfoliosResponse {
  data: Array<{
    id: string
    code: string
    name: string
    currency: { code: string }
  }>
}

interface Props {
  config: StandaloneCompositeConfig
  onClose: () => void
}

/**
 * Confirms the BALANCE trn that links a composite-policy asset (CPF
 * today) to a portfolio. The trn carries the per-sub-account map so
 * svc-position's BalanceBehaviour can persist the full breakdown without
 * impacting the portfolio's cash balance. Repeating the same trn on a
 * later date overwrites the snapshot (term-deposit-like semantics).
 */
export default function LinkCompositeDialog({
  config,
  onClose,
}: Props): React.ReactElement {
  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const [portfolioId, setPortfolioId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Default to first same-currency portfolio once the list arrives.
  const [prevPortfoliosData, setPrevPortfoliosData] = useState(portfoliosData)
  if (portfoliosData !== prevPortfoliosData) {
    setPrevPortfoliosData(portfoliosData)
    if (!portfolioId && portfoliosData?.data?.length) {
      const sameCcy = portfoliosData.data.find(
        (p) => p.currency.code === config.currency,
      )
      setPortfolioId((sameCcy ?? portfoliosData.data[0]).id)
    }
  }

  async function submit(): Promise<void> {
    if (!portfolioId) return
    setSubmitting(true)
    setError(null)
    const today = new Date().toISOString().slice(0, 10)
    const subAccountsMap = Object.fromEntries(
      config.subAccounts.map((sa) => [sa.code, sa.balance]),
    )
    const trnData: Record<string, unknown> = {
      assetId: config.assetId,
      trnType: "BALANCE",
      quantity: config.total,
      tradeAmount: config.total,
      tradeDate: today,
      tradeCurrency: config.currency,
      cashCurrency: config.currency,
      status: "SETTLED",
      comments: `Link ${config.assetName} balance to portfolio`,
      subAccounts: subAccountsMap,
    }
    try {
      const r = await fetch("/api/trns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId, data: [trnData] }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        setError(body.message || body.detail || "Link failed")
        return
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-md bg-white p-4 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">Link {config.assetName}</h2>
        <p className="mb-3 text-sm text-gray-600">
          Records a BALANCE snapshot of{" "}
          <span className="font-medium">
            {config.currency} {Math.round(config.total).toLocaleString()}
          </span>{" "}
          on today&apos;s date. Cash is not affected — re-running on a new date
          replaces the snapshot.
        </p>
        <table className="mb-3 w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th>Sub-account</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {config.subAccounts.map((sa) => (
              <tr key={sa.code}>
                <td>
                  {sa.code}
                  {sa.displayName ? ` — ${sa.displayName}` : ""}
                  {!sa.liquid && (
                    <span className="ml-1 text-xs text-gray-500">(locked)</span>
                  )}
                </td>
                <td className="text-right tabular-nums">
                  {Math.round(sa.balance).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mb-3">
          <label
            htmlFor="link-composite-portfolio"
            className="mb-1 block text-sm font-medium"
          >
            Portfolio
          </label>
          <select
            id="link-composite-portfolio"
            value={portfolioId}
            onChange={(e) => setPortfolioId(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
          >
            {portfoliosData?.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} ({p.currency.code})
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="mb-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1 text-sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-amber-600 px-3 py-1 text-sm text-white disabled:opacity-60"
            onClick={submit}
            disabled={submitting || !portfolioId}
          >
            {submitting ? "Linking…" : "Link"}
          </button>
        </div>
      </div>
    </div>
  )
}
