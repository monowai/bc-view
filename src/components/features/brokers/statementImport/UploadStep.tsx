import React, { useEffect } from "react"
import Alert from "@components/ui/Alert"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { useBrokers } from "@hooks/useBrokers"
import { useGlobalBrokers } from "@hooks/useGlobalBrokers"
import type { Broker, BrokerWithAccounts, Portfolio } from "types/beancounter"
import {
  AccountSelect,
  BrokerageSelect,
  OTHER_FIRM,
} from "./BrokerageAccountPicker"
import ImportSection from "./ImportSection"
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
  "w-full h-10 border border-gray-300 rounded-md px-3 text-base sm:text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-400 transition-colors duration-150"

const labelClass = "block text-xs font-medium text-gray-700 mb-1"

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

  // Each section is done once its choice is made; the first not done is current.
  const done = [
    firmId !== "",
    Boolean(account),
    Boolean(target),
    Boolean(flow.file),
  ]
  const current = done.indexOf(false)

  return (
    <form
      className="max-w-5xl mx-auto bg-white rounded-lg border border-gray-200"
      onSubmit={(event) => {
        event.preventDefault()
        if (target && account && canRead) void flow.read(target, account)
      }}
    >
      <div className="px-5 pt-5 pb-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Upload an image</h2>
        <p className="text-sm text-gray-600 mt-1 max-w-prose">
          Upload an image of the holdings page of your brokerage account.
          Beancounter reads it and shows you what it found. Nothing is recorded
          until you confirm.
        </p>
        {error && (
          <Alert className="mt-3">
            Your portfolios could not be loaded. Reload the page.
          </Alert>
        )}
      </div>

      <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
        <ImportSection
          step={1}
          title="Brokerage"
          lead="The firm the account is with."
          done={done[0]}
          current={current === 0}
        >
          <BrokerageSelect
            firms={firms}
            firmId={firmId}
            disabled={flow.reading}
            className={fieldClass}
            onChoose={flow.chooseFirm}
          />
        </ImportSection>

        <ImportSection
          step={2}
          title="Brokerage account"
          lead="Where the holdings are recorded."
          done={done[1]}
          current={current === 1}
        >
          <div className="space-y-3">
            <AccountSelect
              brokers={brokers}
              chosenId={brokerId}
              firmChosen={firmId !== ""}
              failed={Boolean(brokersError)}
              disabled={flow.reading}
              className={fieldClass}
              onChoose={flow.chooseBroker}
            />
            {creatingAccount && (
              <fieldset className="space-y-3">
                <legend className="sr-only">New brokerage account</legend>
                <div>
                  <label htmlFor="import-account-name" className={labelClass}>
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
                  <label htmlFor="import-account-number" className={labelClass}>
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
                <p className="text-xs text-gray-500">
                  The account is created when you record.
                </p>
              </fieldset>
            )}
          </div>
        </ImportSection>

        <ImportSection
          step={3}
          title="Portfolio"
          lead="The portfolio the changes go into."
          done={done[2]}
          current={current === 2}
        >
          <div className="space-y-3">
            <div>
              <label htmlFor="import-portfolio" className="sr-only">
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
              <p className="text-xs text-gray-500 mt-1.5">
                {creating
                  ? "Named for the brokerage account, and created when you record."
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
          </div>
        </ImportSection>
      </div>

      <ImportSection
        step={4}
        title="Image"
        lead="A screenshot of the account's holdings page."
        done={done[3]}
        current={current === 3}
        className="border-t border-gray-200"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <label htmlFor="import-screenshot" className="sr-only">
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
            {flow.fileError && <Alert>{flow.fileError}</Alert>}
            {flow.readError && <Alert>{flow.readError}</Alert>}
            {flow.unsupported && (
              <Alert variant="warning">
                <p>
                  This screenshot shows a list of transactions. Transaction
                  screenshots are not supported yet, so nothing was recorded.
                </p>
                <p className="mt-1">
                  Upload a holdings screenshot instead: the page that lists what
                  you hold and how many.
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
          </div>
          <div className="flex lg:block">
            <button
              type="submit"
              disabled={!canRead || flow.unsupported}
              className="btn-primary w-full lg:w-auto lg:min-w-40 disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed"
            >
              Read image
            </button>
          </div>
        </div>
      </ImportSection>

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
    </form>
  )
}
