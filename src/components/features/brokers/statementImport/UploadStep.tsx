import React, { useEffect } from "react"
import Alert from "@components/ui/Alert"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { useBrokers } from "@hooks/useBrokers"
import { useGlobalBrokers } from "@hooks/useGlobalBrokers"
import type { Broker, BrokerWithAccounts, Portfolio } from "types/beancounter"
import BrokerageAccountPicker, { OTHER_FIRM } from "./BrokerageAccountPicker"
import { CREATE_ACCOUNT, namedAs, type ImportAccount } from "./newAccount"
import ImageDropZone from "./ImageDropZone"
import type { ImportTarget, StatementImportFlow } from "./useStatementImport"
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

/**
 * Where the read is recorded: a portfolio to create when Create Portfolio is
 * chosen, else the chosen portfolio. None until an account is chosen.
 */
function importTarget(
  broker: Pick<Broker, "name" | "accountNumber"> | undefined,
  creating: boolean,
  portfolio: Portfolio | undefined,
  codesInUse: string[],
  currency: string,
): ImportTarget | undefined {
  if (!broker) return undefined
  if (creating) return { create: newPortfolioFor(broker, codesInUse, currency) }
  return portfolio ? { portfolio } : undefined
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
  // Creating an account is chosen, or the default at a firm with none yet.
  const brokerId =
    flow.chosenBrokerId === CREATE_ACCOUNT
      ? CREATE_ACCOUNT
      : preselect(
          named && brokers.includes(named) ? named.id : "",
          brokers.map((candidate) => candidate.id),
        ) || (firmId && brokers.length === 0 ? CREATE_ACCOUNT : "")
  const broker = brokers.find((candidate) => candidate.id === brokerId)
  const creatingAccount = brokerId === CREATE_ACCOUNT
  const firm = firms.find((candidate) => candidate.id === firmId)
  const newAccountName = flow.newAccountName || firm?.name || ""
  const account: ImportAccount | undefined = creatingAccount
    ? newAccountName.trim()
      ? {
          createAccount: {
            name: newAccountName.trim(),
            accountNumber: flow.newAccountNumber.trim(),
            globalBrokerId: firm?.id,
          },
        }
      : undefined
    : broker && { broker }
  // What a new portfolio is named after: the account, or the one to create.
  const accountNaming =
    account &&
    ("broker" in account ? account.broker : namedAs(account.createAccount))
  // Creating a portfolio is the default; an existing one is the user's choice.
  const selectedId = flow.portfolioId || CREATE_PORTFOLIO
  const portfolio = portfolios.find((candidate) => candidate.id === selectedId)
  const creating = selectedId === CREATE_PORTFOLIO
  const firmCurrency = firms.find((firm) => firm.id === firmId)?.config
    ?.currency
  const currency = flow.newCurrency || firmCurrency || FALLBACK_CURRENCY
  const target = importTarget(
    accountNaming,
    creating,
    portfolio,
    portfolios.map((each) => each.code),
    currency,
  )
  const canRead = Boolean(target && account && flow.file) && !flow.reading

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
        if (target && account && canRead) void flow.read(target, account)
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

      {creatingAccount && (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="import-account-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Account name
            </label>
            <input
              id="import-account-name"
              type="text"
              required
              value={newAccountName}
              disabled={flow.reading}
              onChange={(event) =>
                flow.chooseNewAccountName(event.target.value)
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label
              htmlFor="import-account-number"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Account number
            </label>
            <input
              id="import-account-number"
              type="text"
              value={flow.newAccountNumber}
              disabled={flow.reading}
              onChange={(event) =>
                flow.chooseNewAccountNumber(event.target.value)
              }
              placeholder="Optional"
              className={fieldClass}
            />
          </div>
          <p className="text-xs text-gray-500 sm:col-span-2">
            The account is created when you record.
          </p>
        </fieldset>
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
