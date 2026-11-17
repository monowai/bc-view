import React, { useEffect } from "react"
import Alert from "@components/ui/Alert"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { useBrokers } from "@hooks/useBrokers"
import { useGlobalBrokers } from "@hooks/useGlobalBrokers"
import type { BrokerWithAccounts } from "types/beancounter"
import BrokerageAccountPicker, { OTHER_FIRM } from "./BrokerageAccountPicker"
import ImageDropZone from "./ImageDropZone"
import type { StatementImportFlow } from "./useStatementImport"
import { portfolioLabel, useActivePortfolios } from "./useActivePortfolios"
import CurrencySelect from "./CurrencySelect"
import {
  CREATE_PORTFOLIO,
  FALLBACK_CURRENCY,
  newPortfolioFor,
} from "./newPortfolio"

/**
 * The image on the clipboard. A copied file arrives in `files`; a screenshot
 * copied straight to the clipboard often arrives only as an item.
 */
function clipboardImage(data: DataTransfer | null): File | null {
  if (!data) return null
  const isImage = (file: File | null): file is File =>
    Boolean(file?.type.startsWith("image/"))
  const fromFiles = Array.from(data.files ?? []).find(isImage)
  if (fromFiles) return fromFiles
  return (
    Array.from(data.items ?? [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .find(isImage) ?? null
  )
}

/** What is chosen: the user's own pick, else the only one there is. */
function preselect(chosen: string, ids: string[]): string {
  if (chosen) return chosen
  return ids.length === 1 ? ids[0] : ""
}

/**
 * The accounts offered once a firm is chosen: those at that firm. Another
 * brokerage offers the accounts at no listed firm.
 */
function offeredAt(
  brokers: BrokerWithAccounts[],
  firmId: string,
): BrokerWithAccounts[] {
  if (firmId === "") return []
  return brokers.filter((broker) =>
    firmId === OTHER_FIRM
      ? !broker.globalBrokerId
      : broker.globalBrokerId === firmId,
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
  const { portfolios, error } = useActivePortfolios()
  const { globalBrokers: firms } = useGlobalBrokers()
  const { brokers: allBrokers, error: brokersError } = useBrokers()
  const active = allBrokers.filter((broker) => broker.active !== false)
  // The account chosen, or the only one there is, also names its firm.
  const named = active.find(
    (candidate) =>
      candidate.id ===
      preselect(
        flow.chosenBrokerId,
        active.map((each) => each.id),
      ),
  )
  const firmId =
    flow.chosenFirmId || (named ? named.globalBrokerId || OTHER_FIRM : "")
  const brokers = offeredAt(active, firmId)
  const brokerId = preselect(
    named && brokers.includes(named) ? named.id : "",
    brokers.map((candidate) => candidate.id),
  )
  const broker = brokers.find((candidate) => candidate.id === brokerId)
  // Creating a portfolio is the default; an existing one is the user's choice.
  const selectedId = flow.portfolioId || CREATE_PORTFOLIO
  const portfolio = portfolios.find((candidate) => candidate.id === selectedId)
  const creating = selectedId === CREATE_PORTFOLIO
  const firmCurrency = firms.find((firm) => firm.id === firmId)?.config
    ?.currency
  const currency = flow.newCurrency || firmCurrency || FALLBACK_CURRENCY
  const target =
    broker && (creating || portfolio)
      ? portfolio
        ? { portfolio }
        : {
            create: newPortfolioFor(
              broker,
              portfolios.map((each) => each.code),
              currency,
            ),
          }
      : undefined
  const canRead = Boolean(target && broker && flow.file) && !flow.reading

  // Cmd+V / Ctrl+V anywhere on the step: an image on the clipboard is chosen.
  const { pasteFile, reading } = flow
  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      const image = clipboardImage(event.clipboardData)
      if (!image || reading) return
      event.preventDefault()
      pasteFile(image)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [pasteFile, reading])

  return (
    <form
      className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (target && broker && canRead) void flow.read(target, broker)
      }}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Upload an image</h2>
        <p className="text-sm text-gray-600 mt-1">
          Upload an image of the holdings page of your brokerage account.
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
          <option value={CREATE_PORTFOLIO}>Create Portfolio</option>
          {portfolios.map((option) => (
            <option key={option.id} value={option.id}>
              {portfolioLabel(option)}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {creating
            ? "A portfolio named for the brokerage account is created when you record."
            : "The changes are recorded in this portfolio."}
        </p>
      </div>

      {creating && (
        <CurrencySelect
          id="import-currency"
          value={currency}
          disabled={flow.reading}
          className={fieldClass}
          onChange={flow.chooseNewCurrency}
        />
      )}

      <div>
        <label
          htmlFor="import-screenshot"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Image
        </label>
        <ImageDropZone
          key={flow.fileInputKey}
          id="import-screenshot"
          file={flow.file}
          pasted={flow.pasted}
          disabled={flow.reading}
          onChoose={flow.chooseFile}
          onRemove={flow.chooseAnotherFile}
        />
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
        <Dialog
          title="Reading the image"
          onClose={flow.cancelRead}
          footer={
            <button
              type="button"
              onClick={flow.cancelRead}
              className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          }
        >
          <p role="status" className="text-sm text-gray-700">
            <Spinner label="Reading the image and checking each holding. This can take some time…" />
          </p>
        </Dialog>
      )}

      <button
        type="submit"
        disabled={!canRead || flow.unsupported}
        className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        Read image
      </button>
    </form>
  )
}
