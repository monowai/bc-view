import React, { useState } from "react"
import Alert from "@components/ui/Alert"
import Dialog from "@components/ui/Dialog"
import AssetSearch from "@components/features/assets/AssetSearch"
import Spinner from "@components/ui/Spinner"
import { todayIso } from "@utils/formatters"
import { accountLabel, namedAs } from "./newAccount"
import { portfolioLabel, useActivePortfolios } from "./useActivePortfolios"
import CurrencySelect from "./CurrencySelect"
import {
  CREATE_PORTFOLIO,
  FALLBACK_CURRENCY,
  newPortfolioFor,
} from "./newPortfolio"
import HoldingsTable, { rowStatus } from "./HoldingsTable"
import NotShownList from "./NotShownList"
import ReadSummary, { totalGap } from "./ReadSummary"
import { rowName } from "./statementRows"
import type { StatementImportFlow } from "./useStatementImport"

const fieldClass =
  "w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

/** "Needs a look: 2 will not be recorded · 24 held but not on the image" */
function issueSummary(blocked: number, notShown: number): string {
  const parts = [
    blocked > 0 ? `${blocked} will not be recorded` : "",
    notShown > 0 ? `${notShown} held but not on the image` : "",
  ].filter(Boolean)
  return `Needs a look: ${parts.join(" · ")}`
}

/**
 * Step 2: what was read, beside what is held, for the user to correct and
 * confirm. Nothing is recorded until Record is pressed.
 */
export default function ConfirmStep({
  flow,
}: {
  flow: StatementImportFlow
}): React.ReactElement | null {
  const { session } = flow
  const { portfolios } = useActivePortfolios()
  // Folded unless the read rows do not add up to the total shown.
  const [unfolded, setUnfolded] = useState(
    () => session !== null && totalGap(session.proposal) !== null,
  )
  // The row whose asset is being looked up with the asset search.
  const [findingKey, setFindingKey] = useState<string | null>(null)
  if (!session) return null
  const existing =
    "portfolio" in session.target ? session.target.portfolio : null
  const toCreate = "create" in session.target ? session.target.create : null

  const busy = flow.recording
  const edited = session.preview !== null && session.rows.some(flow.isUnchecked)
  // Every row that Record would leave behind, with the reason.
  const blocked = session.rows
    .map((row, index) => {
      const unchecked = flow.isUnchecked(row)
      const preview = unchecked ? undefined : session.previewByKey[row.key]
      return {
        key: row.key,
        name: rowName(row, index),
        skipped: preview?.status !== "READY" && preview?.status !== "UNCHANGED",
        reason: rowStatus(
          row,
          preview,
          unchecked,
          row.key in session.previewByKey,
        ),
      }
    })
    .filter((row) => row.skipped)
  const changes = flow.readyRows.length
  // Rows that Record acts on first, then rows with an issue, then rows that
  // match what is held. Ordered by the last check, so a row moves only when
  // it is checked again, not while it is being edited.
  const rank = (status: string | undefined): number =>
    status === "READY" ? 0 : status === "UNCHANGED" ? 2 : 1
  const ordered = [...session.rows].sort(
    (a, b) =>
      rank(session.previewByKey[a.key]?.status) -
      rank(session.previewByKey[b.key]?.status),
  )
  const notShown = session.preview?.notShown ?? []
  const findingIndex = session.rows.findIndex((row) => row.key === findingKey)
  const finding =
    findingIndex >= 0
      ? {
          key: session.rows[findingIndex].key,
          name: rowName(session.rows[findingIndex], findingIndex),
        }
      : null

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Confirm what was read
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Check each row against your screenshot. Nothing is recorded until
            you press Record.
          </p>
        </div>
        <button
          type="button"
          onClick={flow.reset}
          disabled={busy}
          className="text-sm text-gray-600 underline"
        >
          Discard and start again
        </button>
      </div>

      {/* One label row, one control row, one hint row: every control lines up. */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid gap-x-8 gap-y-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,20rem)_1fr] sm:items-start">
        <div>
          <label
            htmlFor="import-record-date"
            className="block text-sm font-semibold text-gray-900 mb-1"
          >
            Record date
          </label>
          <input
            id="import-record-date"
            type="date"
            value={session.tradeDate}
            max={todayIso()}
            disabled={busy}
            onChange={(event) => flow.setTradeDate(event.target.value)}
            aria-describedby="import-record-date-hint"
            className="h-10 w-full border border-gray-300 rounded-lg px-3 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p
            id="import-record-date-hint"
            className={`text-xs mt-1.5 ${flow.tradeDateInFuture ? "text-red-700" : "text-gray-500"}`}
          >
            {flow.tradeDateInFuture
              ? "The record date cannot be in the future."
              : "The date of each change, unless the holding has its own held-since date."}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-1">Held since</p>
          <button
            type="button"
            onClick={() => void flow.suggestHeldSince()}
            disabled={busy || flow.suggesting || flow.checking}
            aria-describedby="import-suggest-hint"
            className="h-10 inline-flex items-center gap-2 px-4 rounded-lg border border-blue-300 bg-white text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <i className="far fa-calendar-check" aria-hidden="true"></i>
            Suggest dates
          </button>
          <p id="import-suggest-hint" className="text-xs text-gray-500 mt-1.5">
            Guesses when you bought each holding being added, from its cost, so
            returns are measured over the right period.
          </p>
          {flow.suggestNote && (
            <p className="text-xs text-gray-700 mt-1.5" role="status">
              {flow.suggestNote}
            </p>
          )}
          {flow.suggestError && (
            <Alert className="mt-2">{flow.suggestError}</Alert>
          )}
        </div>
        {/* The top padding matches a label row, so Recheck sits on the control row. */}
        <div className="flex flex-col items-start gap-1.5 sm:items-end sm:pt-6">
          <button
            type="button"
            onClick={() => void flow.recheck()}
            disabled={flow.checking || busy}
            className="h-10 inline-flex items-center gap-2 px-4 rounded-lg bg-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-60"
          >
            <i className="fas fa-rotate-right" aria-hidden="true"></i>
            Recheck
          </button>
          {flow.checking && (
            <span role="status" className="text-xs text-gray-600">
              <Spinner label="Checking against your holdings…" />
            </span>
          )}
        </div>
      </div>

      <details
        open={unfolded}
        onToggle={(event) => setUnfolded(event.currentTarget.open)}
        className="bg-white rounded-xl shadow-sm border border-gray-200 text-sm"
      >
        <summary className="cursor-pointer p-4 font-semibold text-gray-900">
          {`${accountLabel(session.account)} · ${
            existing ? portfolioLabel(existing) : `Create ${toCreate?.name}`
          } · ${session.rows.length} ${session.rows.length === 1 ? "row" : "rows"} read`}
        </summary>
        <div className="px-4 pb-4 space-y-4">
          <ReadSummary proposal={session.proposal} />

          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Brokerage account
              </h3>
              <p className="text-gray-900">{accountLabel(session.account)}</p>
            </div>
            <div>
              <label
                htmlFor="confirm-portfolio"
                className="block font-semibold text-gray-900 mb-1"
              >
                Portfolio
              </label>
              <select
                id="confirm-portfolio"
                value={existing ? existing.id : CREATE_PORTFOLIO}
                disabled={busy || flow.checking}
                onChange={(event) => {
                  const id = event.target.value
                  if (id === CREATE_PORTFOLIO) {
                    void flow.changePortfolio({
                      create: newPortfolioFor(
                        "broker" in session.account
                          ? session.account.broker
                          : namedAs(session.account.createAccount),
                        portfolios.map((each) => each.code),
                        flow.newCurrency ||
                          toCreate?.currency ||
                          FALLBACK_CURRENCY,
                      ),
                    })
                    return
                  }
                  const chosen = portfolios.find((each) => each.id === id)
                  if (chosen) void flow.changePortfolio({ portfolio: chosen })
                }}
                className={fieldClass}
              >
                <option value={CREATE_PORTFOLIO}>Create Portfolio</option>
                {/* The portfolio read into stays listed while the list loads. */}
                {existing && !portfolios.some((p) => p.id === existing.id) && (
                  <option value={existing.id}>
                    {portfolioLabel(existing)}
                  </option>
                )}
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolioLabel(portfolio)}
                  </option>
                ))}
              </select>
              <p className="text-gray-600 mt-1">
                {existing
                  ? "The changes are recorded here."
                  : `${toCreate?.name} is created when you record.`}
              </p>
              {toCreate && (
                <div className="mt-2">
                  <CurrencySelect
                    id="confirm-currency"
                    value={toCreate.currency}
                    disabled={busy}
                    className={fieldClass}
                    onChange={flow.setNewPortfolioCurrency}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </details>

      {(blocked.length > 0 || notShown.length > 0) && (
        <details className="bg-white rounded-xl shadow-sm border border-gray-200 text-sm">
          <summary className="cursor-pointer p-4 font-semibold text-gray-900">
            {issueSummary(blocked.length, notShown.length)}
          </summary>
          <div className="px-4 pb-4 space-y-4">
            {blocked.length > 0 && (
              <section aria-label="Will not be recorded">
                <h3 className="font-semibold text-gray-900">
                  Will not be recorded
                </h3>
                <ul className="mt-2 space-y-1 text-gray-900">
                  {blocked.map((row) => (
                    <li key={row.key}>{`${row.name}: ${row.reason}`}</li>
                  ))}
                </ul>
              </section>
            )}
            <NotShownList notShown={notShown} />
          </div>
        </details>
      )}

      {flow.previewError && <Alert>{flow.previewError}</Alert>}

      <HoldingsTable
        rows={ordered}
        previewByKey={session.previewByKey}
        isUnchecked={flow.isUnchecked}
        checking={flow.checking}
        disabled={busy}
        onEdit={flow.editRow}
        onRemove={flow.removeRow}
        onRecheck={(key) => void flow.recheckRow(key)}
        onFind={setFindingKey}
        onHeldSince={flow.setRowHeldSince}
      />

      {finding && (
        <Dialog
          title={`Find ${finding.name}`}
          onClose={() => setFindingKey(null)}
          maxWidth="lg"
        >
          <p className="text-sm text-gray-600">
            Search for the asset by its code or name. The row takes the code and
            market you pick, and is checked again.
          </p>
          <AssetSearch
            usePortal
            placeholder={finding.name}
            onSelect={(option) => {
              if (!option?.market) return
              const key = finding.key
              setFindingKey(null)
              void flow.recheckRow(key, {
                code: option.symbol,
                market: option.market,
              })
            }}
          />
        </Dialog>
      )}

      {flow.suggesting && (
        <Dialog
          title="Suggesting dates"
          onClose={flow.cancelSuggest}
          footer={
            <button
              type="button"
              onClick={flow.cancelSuggest}
              className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          }
        >
          <p role="status" className="text-sm text-gray-700">
            <Spinner label="Asking the stock market nicely for your price history. It likes to play hard to get…" />
          </p>
        </Dialog>
      )}

      {edited && !flow.checking && (
        <Alert variant="info">
          You have changed some rows. Press Recheck to see what would be
          recorded.
        </Alert>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        {flow.recordError && <Alert>{flow.recordError}</Alert>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void flow.record()}
            disabled={!flow.canRecord}
            className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {`Record ${changes} ${changes === 1 ? "change" : "changes"}`}
          </button>
          {busy && (
            <span role="status" className="text-sm text-gray-600">
              <Spinner label="Recording…" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
