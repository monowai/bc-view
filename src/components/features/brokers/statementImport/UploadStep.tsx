import React from "react"
import useSwr from "swr"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { portfoliosKey } from "@utils/api/client/portfolios"
import type { Portfolio } from "types/beancounter"
import { IMAGE_TYPES } from "./statementRows"
import type { StatementImportFlow } from "./useStatementImport"

const fieldClass =
  "w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

/** Step 1: choose the portfolio and the image, then have it read. */
export default function UploadStep({
  flow,
}: {
  flow: StatementImportFlow
}): React.ReactElement {
  const { data, error } = useSwr<{ data: Portfolio[] }>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const portfolios = (data?.data ?? []).filter(
    (portfolio) => portfolio.active !== false,
  )
  // With one portfolio there is nothing to choose.
  const selectedId =
    flow.portfolioId || (portfolios.length === 1 ? portfolios[0].id : "")
  const portfolio = portfolios.find((candidate) => candidate.id === selectedId)
  const canRead = Boolean(portfolio && flow.file) && !flow.reading

  return (
    <form
      className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (portfolio && canRead) void flow.read(portfolio)
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
              {`${option.name} (${option.code})`}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          The changes are recorded in this portfolio.
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
          <Spinner label="Reading the screenshot. This takes several seconds…" />
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
