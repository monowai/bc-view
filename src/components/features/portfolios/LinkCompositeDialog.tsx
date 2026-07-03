import React, { useState } from "react"
import { usePortfolios } from "@hooks/usePortfolios"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { showPortfolioPicker, solePortfolio } from "@lib/user/zenMode"
import type { StandaloneCompositeConfig } from "@hooks/useStandaloneCompositeAssets"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

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
  const { portfolios } = usePortfolios()
  const { preferences } = useUserPreferences()
  const [portfolioId, setPortfolioId] = useState<string>("")
  const { isSubmitting, submitError: error, handleSubmit } = useDialogSubmit({
    onSuccess: onClose,
    autoCloseDelay: 0,
    fallbackError: "Link failed",
  })

  // Zen-mode users (sole portfolio) skip the picker entirely — the link
  // auto-targets that portfolio. Master-mode users keep the dropdown.
  const needsPick = showPortfolioPicker(portfolios, preferences)
  const sole = solePortfolio(portfolios)

  // Seed a sensible default once the list arrives: the sole portfolio in zen
  // mode, otherwise the first same-currency portfolio.
  const [seeded, setSeeded] = useState(false)
  if (!seeded && portfolios.length) {
    setSeeded(true)
    if (!needsPick && sole) {
      setPortfolioId(sole.id)
    } else {
      const sameCcy = portfolios.find(
        (p) => p.currency.code === config.currency,
      )
      setPortfolioId((sameCcy ?? portfolios[0]).id)
    }
  }

  async function submit(): Promise<void> {
    if (!portfolioId) return
    await handleSubmit(async () => {
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
      const r = await fetch("/api/trns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId, data: [trnData] }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.message || body.detail || "Link failed")
      }
    })
  }

  return (
    <Dialog
      title={`Link ${config.assetName}`}
      onClose={onClose}
      maxWidth="md"
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={submit}
            label="Link"
            loadingLabel="Linking…"
            isSubmitting={isSubmitting}
            disabled={!portfolioId}
            variant="amber"
          />
        </>
      }
    >
      <p className="text-sm text-gray-600">
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
        {needsPick ? (
          <select
            id="link-composite-portfolio"
            value={portfolioId}
            onChange={(e) => setPortfolioId(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} ({p.currency.code})
              </option>
            ))}
          </select>
        ) : (
          <p
            id="link-composite-portfolio"
            className="rounded-md border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700"
          >
            {sole ? `${sole.code} — ${sole.name}` : "—"}
          </p>
        )}
      </div>
      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
