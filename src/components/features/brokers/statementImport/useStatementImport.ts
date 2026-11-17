import {
  MAX_SCREENSHOT_BYTES,
  SCREENSHOT_TOO_LARGE,
} from "@lib/agent/screenshotLimit"
import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { createPortfolios, portfoliosKey } from "@utils/api/client/portfolios"
import {
  brokersWithAccountsKey,
  commitReconcile,
  createBroker,
  previewReconcile,
  readScreenshot,
} from "@utils/api/client/brokers"
import { readServerMessage } from "@utils/api/client/request"
import { todayIso } from "@utils/formatters"
import type {
  Broker,
  ConfirmedHoldings,
  ConfirmedRow,
  Portfolio,
  ReconcilePreview,
  ReconcilePreviewResponse,
  ReconcilePreviewRow,
  ScreenshotProposal,
  TrnResponse,
} from "types/beancounter"
import {
  attachPreview,
  canBeChecked,
  ImportRow,
  readRefusal,
  signature,
  toConfirmedRow,
  toImportRows,
  toShownHolding,
  UNREACHABLE,
} from "./statementRows"
import type { NewPortfolio } from "./newPortfolio"
import type { ImportAccount } from "./newAccount"

type ImportPortfolio = Pick<Portfolio, "id" | "code" | "name">

/** Where the holdings are recorded: a portfolio, or one to create on Record. */
export type ImportTarget =
  { portfolio: ImportPortfolio } | { create: NewPortfolio }

/** One screenshot that was read, and what the user has done with it since. */
interface ImportSession {
  /** Made once per read, so a retry or a double click records once. */
  uploadId: string
  target: ImportTarget
  proposal: ScreenshotProposal
  rows: ImportRow[]
  preview: ReconcilePreview | null
  previewByKey: Record<string, ReconcilePreviewRow>
  /** Each row's editable values as they were last checked. */
  checked: Record<string, string>
  /** The brokerage account the holdings are checked and recorded against. */
  account: ImportAccount
  tradeDate: string
}

interface ImportResult {
  recorded: number
  warnings: string[]
  brokerId: string
}

type EditableField = "code" | "market" | "quantity" | "cost"

type PreviewOutcome = { preview: ReconcilePreview } | { error: string }

async function fetchPreview(
  session: ImportSession,
  sent: ImportRow[],
  signal?: AbortSignal,
): Promise<PreviewOutcome> {
  try {
    const res = await previewReconcile(
      {
        portfolioId:
          "portfolio" in session.target
            ? session.target.portfolio.id
            : undefined,
        brokerId:
          "broker" in session.account ? session.account.broker.id : undefined,
        globalBrokerId:
          "createAccount" in session.account
            ? session.account.createAccount.globalBrokerId
            : undefined,
        brokerName: session.proposal.brokerName ?? undefined,
        accountNumber: session.proposal.accountNumber ?? undefined,
        rows: sent.map(toShownHolding),
      },
      signal,
    )
    if (!res.ok) {
      return {
        error:
          (await readServerMessage(res)) ||
          `The rows could not be checked (error ${res.status}). Try again.`,
      }
    }
    const body = (await res.json()) as ReconcilePreviewResponse
    return { preview: body.data }
  } catch {
    return { error: UNREACHABLE }
  }
}

function withPreview(
  session: ImportSession,
  sent: ImportRow[],
  preview: ReconcilePreview,
): ImportSession {
  return { ...session, preview, ...attachPreview(session.rows, sent, preview) }
}

export interface StatementImportFlow {
  // Upload
  /**
   * The portfolio chosen on the upload step, or CREATE_PORTFOLIO. Once an
   * image is read, `session.target` holds where the holdings are recorded.
   */
  portfolioId: string
  choosePortfolio: (portfolioId: string) => void
  /** The brokerage firm chosen; "" when none is. */
  chosenFirmId: string
  chooseFirm: (firmId: string) => void
  /** The brokerage account chosen; "" when none is. */
  chosenBrokerId: string
  chooseBroker: (brokerId: string) => void
  file: File | null
  /** Changes when the file input must be emptied. */
  fileInputKey: number
  chooseFile: (file: File | null) => void
  /** Use an image pasted from the clipboard, as if it were chosen. */
  pasteFile: (file: File) => void
  /** The file was pasted, so the file input shows none. */
  pasted: boolean
  fileError: string | null
  reading: boolean
  readError: string | null
  /** The screenshot read shows transactions, which are not imported yet. */
  unsupported: boolean
  chooseAnotherFile: () => void
  /** The name and number given for an account to create; "" when not given. */
  newAccountName: string
  chooseNewAccountName: (name: string) => void
  newAccountNumber: string
  chooseNewAccountNumber: (accountNumber: string) => void
  /** The currency chosen for a portfolio to create; "" for the firm's. */
  newCurrency: string
  chooseNewCurrency: (currency: string) => void
  read: (target: ImportTarget, account: ImportAccount) => Promise<void>
  /** Stop waiting for the read; the choices and the file are kept. */
  cancelRead: () => void
  // Confirm
  session: ImportSession | null
  /** The brokerage account the changes would be recorded at. */
  brokerId: string
  isUnchecked: (row: ImportRow) => boolean
  /** Some row was edited since the preview, or there is no preview. */
  stale: boolean
  checking: boolean
  previewError: string | null
  editRow: (key: string, field: EditableField, value: string) => void
  removeRow: (key: string) => void
  /** Record in another portfolio; the rows are checked again. */
  changePortfolio: (target: ImportTarget) => Promise<void>
  /** The currency of the portfolio to create on Record. */
  setNewPortfolioCurrency: (currency: string) => void
  recheck: () => Promise<void>
  /**
   * Check one row again, leaving the others' answers as they are; `change`
   * replaces its code and market first, as a pick from the asset search does.
   */
  recheckRow: (
    key: string,
    change?: { code: string; market: string },
  ) => Promise<void>
  setTradeDate: (tradeDate: string) => void
  tradeDateInFuture: boolean
  /** What Record would send. */
  readyRows: ConfirmedRow[]
  canRecord: boolean
  recording: boolean
  recordError: string | null
  record: () => Promise<void>
  // Done
  result: ImportResult | null
  reset: () => void
}

/**
 * The screenshot import from first upload to recorded transactions: read the
 * image, preview the holdings it shows against what is held, let the user edit
 * and re-check, then record the rows that are ready.
 */
export function useStatementImport(): StatementImportFlow {
  const [portfolioId, setPortfolioId] = useState("")
  const [newCurrency, setNewCurrency] = useState("")
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountNumber, setNewAccountNumber] = useState("")
  const { mutate } = useSWRConfig()
  const [chosenFirmId, setChosenFirmId] = useState("")
  const [chosenBrokerId, setChosenBrokerId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [pasted, setPasted] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)
  const [session, setSession] = useState<ImportSession | null>(null)
  const [checking, setChecking] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  // State lags a second click by a render; these do not. A second read would
  // be a second paid call, a second record a second request.
  const readInFlight = useRef(false)
  // Aborts the read in flight when the user cancels it.
  const readAbort = useRef<AbortController | null>(null)
  const recordInFlight = useRef(false)
  // Only the newest preview asked for may land.
  const latestCheck = useRef(0)

  const clearFile = (): void => {
    setPasted(false)
    setFile(null)
    setFileError(null)
    setFileInputKey((key) => key + 1)
  }

  const chooseFile = (chosen: File | null): void => {
    setPasted(false)
    setReadError(null)
    setUnsupported(false)
    if (chosen && chosen.size > MAX_SCREENSHOT_BYTES) {
      setFile(null)
      setFileError(SCREENSHOT_TOO_LARGE)
      // Empty the input too, so it does not show a file that was refused.
      setFileInputKey((key) => key + 1)
      return
    }
    setFileError(null)
    setFile(chosen)
  }

  const pasteFile = (image: File): void => {
    chooseFile(image)
    // The input cannot show a pasted file: empty it, and say what was pasted.
    setFileInputKey((key) => key + 1)
    if (image.size <= MAX_SCREENSHOT_BYTES) setPasted(true)
  }

  const chooseAnotherFile = (): void => {
    setUnsupported(false)
    setReadError(null)
    clearFile()
  }

  const read = async (
    target: ImportTarget,
    account: ImportAccount,
  ): Promise<void> => {
    if (!file || readInFlight.current) return
    readInFlight.current = true
    setReading(true)
    setReadError(null)
    setUnsupported(false)
    const abort = new AbortController()
    readAbort.current = abort
    try {
      const res = await readScreenshot(file, abort.signal)
      if (!res.ok) {
        setReadError(await readRefusal(res))
        return
      }
      const proposal = (await res.json()) as ScreenshotProposal
      if (proposal.documentType !== "HOLDINGS") {
        setUnsupported(true)
        return
      }
      const fresh: ImportSession = {
        uploadId: crypto.randomUUID(),
        target,
        account,
        proposal,
        rows: toImportRows(proposal),
        preview: null,
        previewByKey: {},
        checked: {},
        tradeDate: todayIso(),
      }
      const sent = fresh.rows.filter(canBeChecked)
      const outcome = await fetchPreview(fresh, sent, abort.signal)
      // Cancelled while the rows were checked: leave the form as it was.
      if (abort.signal.aborted) return
      setPreviewError("error" in outcome ? outcome.error : null)
      setRecordError(null)
      setSession(
        "preview" in outcome
          ? withPreview(fresh, sent, outcome.preview)
          : fresh,
      )
    } catch {
      // A cancelled read is the user's choice, not a failure.
      if (!abort.signal.aborted) setReadError(UNREACHABLE)
    } finally {
      if (readAbort.current === abort) readAbort.current = null
      readInFlight.current = false
      setReading(false)
    }
  }

  const cancelRead = (): void => {
    readAbort.current?.abort()
  }

  /** Preview `target`'s rows and attach the answer to whatever is on screen by then. */
  const check = async (target: ImportSession): Promise<void> => {
    const mine = ++latestCheck.current
    const sent = target.rows.filter(canBeChecked)
    setChecking(true)
    setPreviewError(null)
    const outcome = await fetchPreview(target, sent)
    if (mine !== latestCheck.current) return
    setChecking(false)
    if ("error" in outcome) {
      setPreviewError(outcome.error)
      return
    }
    setSession((current) =>
      current?.uploadId === target.uploadId
        ? withPreview(current, sent, outcome.preview)
        : current,
    )
  }

  const editRow = (key: string, field: EditableField, value: string): void => {
    setSession(
      (current) =>
        current && {
          ...current,
          rows: current.rows.map((row) =>
            row.key !== key
              ? row
              : // A market the user chooses is theirs, not svc-data's guess.
                field === "market"
                ? { ...row, market: value, marketFrom: undefined }
                : { ...row, [field]: value },
          ),
        },
    )
  }

  const removeRow = (key: string): void => {
    setSession(
      (current) =>
        current && {
          ...current,
          rows: current.rows.filter((row) => row.key !== key),
        },
    )
  }

  const changePortfolio = async (target: ImportTarget): Promise<void> => {
    if (!session) return
    // The old preview was for the old portfolio: drop it until the new one arrives.
    const next: ImportSession = {
      ...session,
      target,
      preview: null,
      previewByKey: {},
      checked: {},
    }
    setSession(next)
    await check(next)
  }

  const setNewPortfolioCurrency = (currency: string): void => {
    setNewCurrency(currency)
    setSession(
      (current) =>
        current &&
        ("create" in current.target
          ? {
              ...current,
              target: { create: { ...current.target.create, currency } },
            }
          : current),
    )
  }

  const recheckRow = async (
    key: string,
    change?: { code: string; market: string },
  ): Promise<void> => {
    const found = session?.rows.find((candidate) => candidate.key === key)
    const row: ImportRow | undefined =
      found && change ? { ...found, ...change, marketFrom: undefined } : found
    if (!session || !row || !canBeChecked(row)) return
    if (change) {
      setSession(
        (current) =>
          current && {
            ...current,
            rows: current.rows.map((each) => (each.key === key ? row : each)),
          },
      )
    }
    const mine = ++latestCheck.current
    setChecking(true)
    setPreviewError(null)
    const outcome = await fetchPreview(session, [row])
    if (mine !== latestCheck.current) return
    setChecking(false)
    if ("error" in outcome) {
      setPreviewError(outcome.error)
      return
    }
    setSession((current) => {
      if (current?.uploadId !== session.uploadId) return current
      const attached = attachPreview(current.rows, [row], outcome.preview)
      return {
        ...current,
        rows: attached.rows,
        previewByKey: { ...current.previewByKey, ...attached.previewByKey },
        checked: { ...current.checked, ...attached.checked },
        // One row says nothing about what else is held: keep the full
        // check's list, or show none until a full check answers.
        preview: current.preview ?? { ...outcome.preview, notShown: [] },
      }
    })
  }

  const recheck = async (): Promise<void> => {
    if (session) await check(session)
  }

  const setTradeDate = (tradeDate: string): void => {
    setSession((current) => current && { ...current, tradeDate })
  }

  const isUnchecked = (row: ImportRow): boolean =>
    signature(row) !== (session?.checked[row.key] ?? "")

  const rows = session?.rows ?? []
  const stale = !session?.preview || rows.some(isUnchecked)
  const brokerId =
    session && "broker" in session.account ? session.account.broker.id : ""
  const readyRows = rows
    .filter((row) => !isUnchecked(row))
    .map((row) => toConfirmedRow(session?.previewByKey[row.key]))
    .filter((row): row is ConfirmedRow => row !== null)
  const tradeDateInFuture = (session?.tradeDate ?? "") > todayIso()
  const canRecord =
    !stale &&
    !checking &&
    !recording &&
    !tradeDateInFuture &&
    readyRows.length > 0

  /**
   * The id of the portfolio to record in, creating it first when asked to.
   * A created portfolio replaces the request, so a retry does not create
   * another. Null, with the reason shown, when it cannot be created.
   */
  const portfolioFor = async (
    current: ImportSession,
  ): Promise<string | null> => {
    if ("portfolio" in current.target) return current.target.portfolio.id
    const { code, name, currency } = current.target.create
    const res = await createPortfolios({
      data: [{ code, name, currency, base: currency }],
    })
    if (!res.ok) {
      setRecordError(
        (await readServerMessage(res)) ||
          `The portfolio could not be created (error ${res.status}). Nothing was recorded.`,
      )
      return null
    }
    const created = ((await res.json()) as { data?: Portfolio[] }).data?.[0]
    if (!created) {
      setRecordError(
        "Beancounter did not return the portfolio it was asked to create. Nothing was recorded. Check your portfolios before trying again.",
      )
      return null
    }
    setSession((now) =>
      now?.uploadId === current.uploadId
        ? { ...now, target: { portfolio: created } }
        : now,
    )
    await mutate(portfoliosKey)
    return created.id
  }

  /**
   * The id of the brokerage account to record against, creating it first when
   * asked to. A created account replaces the request, so a retry does not
   * create another. Null, with the reason shown, when it cannot be created.
   */
  const accountFor = async (current: ImportSession): Promise<string | null> => {
    if ("broker" in current.account) return current.account.broker.id
    const { name, accountNumber, globalBrokerId } =
      current.account.createAccount
    const res = await createBroker({
      name,
      accountNumber: accountNumber || undefined,
      globalBrokerId,
    })
    if (!res.ok) {
      setRecordError(
        (await readServerMessage(res)) ||
          `The brokerage account could not be created (error ${res.status}). Nothing was recorded.`,
      )
      return null
    }
    const created = ((await res.json()) as { data?: Broker }).data
    if (!created?.id) {
      setRecordError(
        "Beancounter did not return the brokerage account it was asked to create. Nothing was recorded. Check your brokerage accounts before trying again.",
      )
      return null
    }
    setSession((now) =>
      now?.uploadId === current.uploadId
        ? { ...now, account: { broker: created } }
        : now,
    )
    await mutate(brokersWithAccountsKey)
    return created.id
  }

  const record = async (): Promise<void> => {
    if (!session || !canRecord || recordInFlight.current) return
    recordInFlight.current = true
    setRecording(true)
    setRecordError(null)
    try {
      const accountId = await accountFor(session)
      if (!accountId) return
      const portfolioId = await portfolioFor(session)
      if (!portfolioId) return
      const confirmed: ConfirmedHoldings = {
        portfolioId,
        brokerId: accountId,
        uploadId: session.uploadId,
        tradeDate: session.tradeDate || undefined,
        rows: readyRows,
      }
      const res = await commitReconcile(confirmed)
      if (!res.ok) {
        setRecordError(
          (await readServerMessage(res)) ||
            `Nothing was recorded (error ${res.status}). Try again.`,
        )
        return
      }
      const saved = (await res.json()) as TrnResponse
      setResult({
        recorded: saved.data?.trns?.length ?? confirmed.rows.length,
        warnings: saved.warnings ?? [],
        brokerId: accountId,
      })
    } catch {
      setRecordError(UNREACHABLE)
    } finally {
      recordInFlight.current = false
      setRecording(false)
    }
  }

  const reset = (): void => {
    setNewAccountName("")
    setNewAccountNumber("")
    latestCheck.current++
    setSession(null)
    setResult(null)
    setChecking(false)
    setPreviewError(null)
    setRecordError(null)
    setReadError(null)
    setUnsupported(false)
    // The next import's portfolio takes its firm's currency unless chosen again.
    setNewCurrency("")
    clearFile()
  }

  return {
    portfolioId,
    choosePortfolio: setPortfolioId,
    newCurrency,
    chooseNewCurrency: setNewCurrency,
    newAccountName,
    chooseNewAccountName: setNewAccountName,
    newAccountNumber,
    chooseNewAccountNumber: setNewAccountNumber,
    chosenFirmId,
    chooseFirm: setChosenFirmId,
    chosenBrokerId,
    chooseBroker: setChosenBrokerId,
    file,
    fileInputKey,
    chooseFile,
    pasteFile,
    pasted,
    fileError,
    reading,
    readError,
    unsupported,
    chooseAnotherFile,
    read,
    cancelRead,
    session,
    brokerId,
    isUnchecked,
    stale,
    checking,
    previewError,
    editRow,
    removeRow,
    changePortfolio,
    setNewPortfolioCurrency,
    recheck,
    recheckRow,
    setTradeDate,
    tradeDateInFuture,
    readyRows,
    canRecord,
    recording,
    recordError,
    record,
    result,
    reset,
  }
}
