import React from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { useBrokers } from "@hooks/useBrokers"
import { useGlobalBrokers } from "@hooks/useGlobalBrokers"
import {
  newPortfolioHref,
  SCREENSHOT_IMPORT_PATH,
} from "@lib/portfolio/returnTo"
import type { BrokerWithAccounts } from "types/beancounter"
import BrokerageAccountPicker, { OTHER_FIRM } from "./BrokerageAccountPicker"
import { IMAGE_TYPES } from "./statementRows"
import type { StatementImportFlow } from "./useStatementImport"
import { portfolioLabel, useActivePortfolios } from "./useActivePortfolios"

/**
 * What is chosen: the user's own pick, else the one the address names (the
 * new-portfolio page sends the user back that way), else the only one there is.
 */
function preselect(
  chosen: string,
  named: string | string[] | undefined,
  ids: string[],
): string {
  if (chosen) return chosen
  if (typeof named === "string" && ids.includes(named)) return named
  return ids.length === 1 ? ids[0] : ""
}

/**
 * The accounts offered once a firm is chosen: its own and those linked to no
 * firm yet. Another brokerage offers only the unlinked ones.
 */
function offeredAt(
  brokers: BrokerWithAccounts[],
  firmId: string,
): BrokerWithAccounts[] {
  if (firmId === "") return []
  return brokers.filter(
    (broker) =>
      !broker.globalBrokerId ||
      (firmId !== OTHER_FIRM && broker.globalBrokerId === firmId),
  )
}

const fieldClass =
  "w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

/** Step 1: choose the brokerage, the account, the portfolio and the image, then have it read. */
export default function UploadStep({
  flow,
}: {
  flow: StatementImportFlow
}): React.ReactElement {
  const { query } = useRouter()
  const { portfolios, error } = useActivePortfolios()
  const { globalBrokers: firms } = useGlobalBrokers()
  const { brokers: allBrokers, error: brokersError } = useBrokers()
  const active = allBrokers.filter((broker) => broker.active !== false)
  // An account named or the only one there is also names its firm.
  const named = active.find(
    (candidate) =>
      candidate.id ===
      preselect(
        flow.chosenBrokerId,
        query.broker,
        active.map((each) => each.id),
      ),
  )
  const firmId = flow.chosenFirmId || named?.globalBrokerId || ""
  const brokers = offeredAt(active, firmId)
  const brokerId = preselect(
    named && brokers.includes(named) ? named.id : "",
    undefined,
    brokers.map((candidate) => candidate.id),
  )
  const broker = brokers.find((candidate) => candidate.id === brokerId)
  // An account linked to no firm is linked to the one chosen when it is read.
  const linkFirmId =
    broker && !broker.globalBrokerId && firmId !== OTHER_FIRM ? firmId : null
  const selectedId = preselect(
    flow.portfolioId,
    query.portfolio,
    portfolios.map((candidate) => candidate.id),
  )
  // The new-portfolio page comes back here, keeping the account chosen.
  const newPortfolio = newPortfolioHref(
    brokerId
      ? `${SCREENSHOT_IMPORT_PATH}?broker=${encodeURIComponent(brokerId)}`
      : SCREENSHOT_IMPORT_PATH,
  )
  const portfolio = portfolios.find((candidate) => candidate.id === selectedId)
  const canRead = Boolean(portfolio && broker && flow.file) && !flow.reading

  return (
    <form
      className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (portfolio && broker && canRead)
          void flow.read(portfolio, broker, linkFirmId)
      }}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Upload a screenshot
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Take a screenshot of the holdings page of your brokerage account.
          Beancounter reads it and shows you what it found. Nothing is recorded
          until you confirm.
        </p>
      </div>

      {error && (
        <Alert>Your portfolios could not be loaded. Reload the page.</Alert>
      )}

      <BrokerageAccountPicker
        firms={firms}
        firmId={firmId}
        brokers={brokers}
        chosenId={brokerId}
        linking={linkFirmId !== null}
        failed={Boolean(brokersError)}
        disabled={flow.reading}
        className={fieldClass}
        onChooseFirm={flow.chooseFirm}
        onChoose={flow.chooseBroker}
      />

      <div>
        <label
          htmlFor="import-portfolio"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Portfolio
        </label>
        <select
          id="import-portfolio"
          required
          value={selectedId}
          onChange={(event) => flow.choosePortfolio(event.target.value)}
          disabled={flow.reading}
          className={fieldClass}
        >
          <option value="">Choose a portfolio…</option>
          {portfolios.map((option) => (
            <option key={option.id} value={option.id}>
              {portfolioLabel(option)}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          The changes are recorded in this portfolio. Not listed?{" "}
          <Link href={newPortfolio} className="text-blue-600 underline">
            New portfolio
          </Link>
        </p>
      </div>

      <div>
        <label
          htmlFor="import-screenshot"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Screenshot
        </label>
        <input
          key={flow.fileInputKey}
          id="import-screenshot"
          type="file"
          aria-required="true"
          accept={IMAGE_TYPES}
          disabled={flow.reading}
          onChange={(event) => flow.chooseFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-gray-700"
        />
        <p className="text-xs text-gray-500 mt-1">
          PNG, JPEG, WebP or GIF, up to 8 MB.
        </p>
      </div>

      {flow.fileError && <Alert>{flow.fileError}</Alert>}
      {flow.readError && <Alert>{flow.readError}</Alert>}

      {flow.unsupported && (
        <Alert variant="warning">
          <p>
            This screenshot shows a list of transactions. Transaction
            screenshots are not supported yet, so nothing was recorded.
          </p>
          <p className="mt-1">
            Upload a holdings screenshot instead: the page that lists what you
            hold and how many.
          </p>
          <button
            type="button"
            onClick={flow.chooseAnotherFile}
            className="mt-2 underline font-medium"
          >
            Choose another file
          </button>
        </Alert>
      )}

      {flow.reading && (
        <p role="status" className="text-sm text-gray-600">
          <Spinner label="Reading the screenshot. This can take some time…" />
        </p>
      )}

      <button
        type="submit"
        disabled={!canRead || flow.unsupported}
        className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        Read screenshot
      </button>
    </form>
  )
}
