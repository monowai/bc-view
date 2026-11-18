import {
  MAX_SCREENSHOT_BYTES,
  SCREENSHOT_TOO_LARGE,
} from "@lib/agent/screenshotLimit"
import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { createPortfolios, portfoliosKey } from "@utils/api/client/portfolios"
import { holdingByIdKey } from "@utils/api/client/holdings"
import {
  brokersWithAccountsKey,
  commitReconcile,
  createBroker,
  previewReconcile,
  readScreenshot,
  suggestHeldSince as suggestHeldSinceRequest,
} from "@utils/api/client/brokers"
import { readServerMessage } from "@utils/api/client/request"
import { todayIso } from "@utils/formatters"
import type {
  Broker,
  ConfirmedHoldings,
  ConfirmedRow,
  HeldSinceResponse,
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
  GUESSED_BEFORE_PRICES,
  GUESSED_FROM_COST,
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

/** "Suggested dates for 3 holdings. No date could be suggested for T." */
function suggestedNote(
  found: number,
  missed: string[],
  unknown: string[],
): string {
  const said =
    found === 0
      ? ""
      : found === 1
        ? "Suggested a date for 1 holding."
        : `Suggested dates for ${found} holdings.`
  const none = missed.length
    ? `No date could be suggested for ${missed.join(", ")}.`
    : ""
  const unpriced = unknown.length
    ? `No price history yet for ${unknown.join(", ")}: enter ${unknown.length === 1 ? "its date" : "their dates"}.`
    : ""
  return [said, none, unpriced].filter(Boolean).join(" ")
}

/**
 * Why Suggest dates had nothing to do: only holdings being added take a date,
 * and a holding that matches what is held is not added.
 */
function nothingToDate(session: ImportSession): string {
  const statuses = session.rows.map(
    (row) => session.previewByKey[row.key]?.status,
  )
  const adding = session.rows.some(
    (row) => session.previewByKey[row.key]?.trnType === "ADD",
  )
  const matching = statuses.filter((status) => status === "UNCHANGED").length
  const said = adding
    ? "Every holding being added already has a date."
    : "No holding is being added, so none takes a date."
  if (matching === 0) return said
  return matching === 1
    ? `${said} 1 holding already matches what is held, so takes no date.`
    : `${said} ${matching} holdings already match what is held, so take no date.`
}

/** A new account's cash, in the currency its portfolio is now created in. */
function withCashCurrency(
  account: ImportAccount,
  currency: string,
): ImportAccount {
  if (!("createAccount" in account)) return account
  const { cash } = account.createAccount
  if (!cash) return account
  return {
    createAccount: { ...account.createAccount, cash: { ...cash, currency } },
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
  /**
   * The name and number given for an account to create. The name is null
   * until the user edits it, so the firm's name can stand in; "" once cleared.
   */
  newAccountName: string | null
  chooseNewAccountName: (name: string) => void
  newAccountNumber: string
  chooseNewAccountNumber: (accountNumber: string) => void
  /** The opening cash balance typed for an account to create; "" for none. */
  newAccountCash: string
  chooseNewAccountCash: (cash: string) => void
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
  /** One row's held-since date. */
  setRowHeldSince: (key: string, heldSince: string) => void
  /** Fill empty held-since dates by guessing from each added holding's cost. */
  suggestHeldSince: () => Promise<void>
  /** Stop waiting for Suggest dates; no date changes. */
  cancelSuggest: () => void
  suggesting: boolean
  suggestError: string | null
  /** What the last Suggest dates found, in words for the user. */
  suggestNote: string | null
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
  const [newAccountName, setNewAccountName] = useState<string | null>(null)
  const [newAccountNumber, setNewAccountNumber] = useState("")
  const [newAccountCash, setNewAccountCash] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [suggestNote, setSuggestNote] = useState<string | null>(null)
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
  // Aborts the Suggest dates request in flight when the user cancels it.
  const suggestAbort = useRef<AbortController | null>(null)
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
              account: withCashCurrency(current.account, currency),
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

  const setRowHeldSince = (key: string, heldSince: string): void => {
    setSession(
      (current) =>
        current && {
          ...current,
          rows: current.rows.map((row) =>
            row.key === key
              ? { ...row, heldSince, heldSinceHint: undefined }
              : row,
          ),
        },
    )
  }

  /**
   * Guess when each added holding was opened, from its cost and the asset's
   * price history. Rows with a date, read or entered, are left as they are.
   */
  const suggestHeldSince = async (): Promise<void> => {
    if (!session) return
    const asked = session.rows.flatMap((row) => {
      const preview = session.previewByKey[row.key]
      if (row.heldSince || preview?.trnType !== "ADD" || !preview.assetId)
        return []
      if (!preview.cost || !preview.quantity) return []
      return [
        {
          key: row.key,
          code: row.code.trim(),
          assetId: preview.assetId,
          costPerShare: preview.cost / preview.quantity,
        },
      ]
    })
    // A listing new to Beancounter is created on Record: no prices to go on yet.
    const unknown = session.rows
      .filter((row) => {
        const preview = session.previewByKey[row.key]
        return !row.heldSince && preview?.trnType === "ADD" && !preview.assetId
      })
      .map((row) => row.code.trim())
    if (asked.length === 0) {
      setSuggestError(null)
      setSuggestNote(suggestedNote(0, [], unknown) || nothingToDate(session))
      return
    }
    const { uploadId } = session
    const abort = new AbortController()
    suggestAbort.current = abort
    setSuggesting(true)
    setSuggestError(null)
    setSuggestNote(null)
    try {
      const res = await suggestHeldSinceRequest(
        {
          rows: asked.map(({ assetId, costPerShare }) => ({
            assetId,
            costPerShare,
          })),
        },
        abort.signal,
      )
      // Cancelled while the dates were fetched: leave them as they were.
      if (abort.signal.aborted) return
      if (!res.ok) {
        setSuggestError(
          (await readServerMessage(res)) ||
            `Held-since dates could not be guessed (error ${res.status}). Enter them yourself.`,
        )
        return
      }
      const { data } = (await res.json()) as HeldSinceResponse
      if (abort.signal.aborted) return
      const byAsset = new Map(data.map((each) => [each.assetId, each]))
      const keys = new Map(asked.map((each) => [each.key, each.assetId]))
      const missed = asked
        .filter((each) => {
          const answer = byAsset.get(each.assetId)
          return !answer?.heldSince && !answer?.before
        })
        .map((each) => each.code)
      setSuggestNote(
        suggestedNote(asked.length - missed.length, missed, unknown),
      )
      // Guesses for an upload since discarded or re-read are dropped.
      setSession((current) =>
        current?.uploadId !== uploadId
          ? current
          : {
              ...current,
              rows: current.rows.map((row) => {
                const guess = byAsset.get(keys.get(row.key) ?? "")
                const heldSince = guess?.heldSince ?? guess?.before
                if (!heldSince || row.heldSince) return row
                return {
                  ...row,
                  heldSince,
                  heldSinceHint: guess?.heldSince
                    ? GUESSED_FROM_COST
                    : GUESSED_BEFORE_PRICES,
                }
              }),
            },
      )
    } catch {
      // A cancelled suggestion is the user's choice, not a failure.
      if (!abort.signal.aborted) setSuggestError(UNREACHABLE)
    } finally {
      if (suggestAbort.current === abort) suggestAbort.current = null
      setSuggesting(false)
    }
  }

  const cancelSuggest = (): void => {
    suggestAbort.current?.abort()
  }

  const isUnchecked = (row: ImportRow): boolean =>
    signature(row) !== (session?.checked[row.key] ?? "")

  const rows = session?.rows ?? []
  const stale = !session?.preview || rows.some(isUnchecked)
  const brokerId =
    session && "broker" in session.account ? session.account.broker.id : ""
  const readyRows = rows
    .filter((row) => !isUnchecked(row))
    .map((row) => {
      const confirmed = toConfirmedRow(session?.previewByKey[row.key])
      // An added holding carries when it was opened, if known; otherwise, and
      // for a reduction, the record date.
      return confirmed?.trnType === "ADD" && row.heldSince
        ? { ...confirmed, tradeDate: row.heldSince }
        : confirmed
    })
    .filter((row): row is ConfirmedRow => row !== null)
  const today = todayIso()
  const tradeDateInFuture =
    (session?.tradeDate ?? "") > today ||
    rows.some((row) => row.heldSince > today)
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

  /**
   * Value the portfolio now, so its market value reflects what was recorded.
   * svc-position values a portfolio when its holdings are read, and publishes
   * the result to svc-data. In the background: recording has already succeeded.
   */
  const valuePortfolio = async (portfolioId: string): Promise<void> => {
    try {
      await fetch(holdingByIdKey(portfolioId, "today"))
      await mutate(portfoliosKey)
    } catch {
      // The scheduled valuation catches up; nothing the user needs to act on.
    }
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
        cash:
          "createAccount" in session.account
            ? session.account.createAccount.cash
            : undefined,
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
      void valuePortfolio(portfolioId)
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
    suggestAbort.current?.abort()
    setSuggestNote(null)
    setSuggestError(null)
    setNewAccountName(null)
    setNewAccountNumber("")
    setNewAccountCash("")
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
    newAccountCash,
    chooseNewAccountCash: setNewAccountCash,
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
    setRowHeldSince,
    suggestHeldSince,
    cancelSuggest,
    suggesting,
    suggestError,
    suggestNote,
    readyRows,
    canRecord,
    recording,
    recordError,
    record,
    result,
    reset,
  }
}
