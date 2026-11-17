import React from "react"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { todayIso } from "@utils/formatters"
import { brokerLabel } from "./BrokerageAccountPicker"
import { portfolioLabel, useActivePortfolios } from "./useActivePortfolios"
import HoldingsTable, { rowStatus } from "./HoldingsTable"
import NotShownList from "./NotShownList"
import ReadSummary from "./ReadSummary"
import { rowName } from "./statementRows"
import type { StatementImportFlow } from "./useStatementImport"

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
  if (!session) return null

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

      <ReadSummary proposal={session.proposal} />

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-sm grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">
            Brokerage account
          </h3>
          <p className="text-gray-900">{brokerLabel(session.broker)}</p>
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
            value={session.portfolio.id}
            disabled={busy || flow.checking}
            onChange={(event) => {
              const chosen = portfolios.find(
                (portfolio) => portfolio.id === event.target.value,
              )
              if (chosen) void flow.changePortfolio(chosen)
            }}
            className="w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* The portfolio read into stays listed while the list loads. */}
            {!portfolios.some((p) => p.id === session.portfolio.id) && (
              <option value={session.portfolio.id}>
                {portfolioLabel(session.portfolio)}
              </option>
            )}
            {portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolioLabel(portfolio)}
              </option>
            ))}
          </select>
          <p className="text-gray-600 mt-1">The changes are recorded here.</p>
        </div>
      </section>

      {flow.previewError && <Alert>{flow.previewError}</Alert>}

      <HoldingsTable
        rows={session.rows}
        previewByKey={session.previewByKey}
        isUnchecked={flow.isUnchecked}
        checking={flow.checking}
        disabled={busy}
        onEdit={flow.editRow}
        onRemove={flow.removeRow}
      />

      {edited && !flow.checking && (
        <Alert variant="info">
          You have changed some rows. Press Re-check to see what would be
          recorded.
        </Alert>
      )}

      {blocked.length > 0 && (
        <section
          aria-label="Will not be recorded"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-sm"
        >
          <h3 className="font-semibold text-gray-900">Will not be recorded</h3>
          <ul className="mt-2 space-y-1 text-gray-900">
            {blocked.map((row) => (
              <li key={row.key}>{`${row.name}: ${row.reason}`}</li>
            ))}
          </ul>
        </section>
      )}

      <NotShownList notShown={session.preview?.notShown ?? []} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div>
          <label
            htmlFor="import-trade-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Trade date
          </label>
          <input
            id="import-trade-date"
            type="date"
            value={session.tradeDate}
            max={todayIso()}
            disabled={busy}
            onChange={(event) => flow.setTradeDate(event.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {flow.tradeDateInFuture
              ? "The trade date cannot be in the future."
              : "The date the recorded transactions carry."}
          </p>
        </div>

        {flow.recordError && <Alert>{flow.recordError}</Alert>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void flow.recheck()}
            disabled={flow.checking || busy}
            className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-60"
          >
            Re-check
          </button>
          <button
            type="button"
            onClick={() => void flow.record()}
            disabled={!flow.canRecord}
            className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {`Record ${changes} ${changes === 1 ? "change" : "changes"}`}
          </button>
          {(flow.checking || busy) && (
            <span role="status" className="text-sm text-gray-600">
              <Spinner
                label={busy ? "Recording…" : "Checking against your holdings…"}
              />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
