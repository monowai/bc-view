import React, { useState } from "react"
import Alert from "@components/ui/Alert"
import Dialog from "@components/ui/Dialog"
import AssetSearch from "@components/features/assets/AssetSearch"
import Spinner from "@components/ui/Spinner"
import { todayIso } from "@utils/formatters"
import { brokerLabel } from "./BrokerageAccountPicker"
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-4">
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
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {flow.tradeDateInFuture
              ? "The record date cannot be in the future."
              : "The date the recorded transactions carry."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void flow.recheck()}
          disabled={flow.checking || busy}
          className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-60 mb-5"
        >
          <i className="fas fa-rotate-right mr-2" aria-hidden="true"></i>
          Recheck
        </button>
        {flow.checking && (
          <span role="status" className="text-sm text-gray-600 mb-6">
            <Spinner label="Checking against your holdings…" />
          </span>
        )}
      </div>

      <details
        open={unfolded}
        onToggle={(event) => setUnfolded(event.currentTarget.open)}
        className="bg-white rounded-xl shadow-sm border border-gray-200 text-sm"
      >
        <summary className="cursor-pointer p-4 font-semibold text-gray-900">
          {`${brokerLabel(session.broker)} · ${
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
                value={existing ? existing.id : CREATE_PORTFOLIO}
                disabled={busy || flow.checking}
                onChange={(event) => {
                  const id = event.target.value
                  if (id === CREATE_PORTFOLIO) {
                    void flow.changePortfolio({
                      create: newPortfolioFor(
                        session.broker,
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

      {flow.previewError && <Alert>{flow.previewError}</Alert>}

      <HoldingsTable
        rows={session.rows}
        previewByKey={session.previewByKey}
        isUnchecked={flow.isUnchecked}
        checking={flow.checking}
        disabled={busy}
        onEdit={flow.editRow}
        onRemove={flow.removeRow}
        onRecheck={(key) => void flow.recheckRow(key)}
        onFind={setFindingKey}
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

      {edited && !flow.checking && (
        <Alert variant="info">
          You have changed some rows. Press Recheck to see what would be
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
