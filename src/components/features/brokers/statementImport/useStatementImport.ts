import {
  MAX_SCREENSHOT_BYTES,
  SCREENSHOT_TOO_LARGE,
} from "@lib/agent/screenshotLimit"
import { useRef, useState } from "react"
import {
  commitReconcile,
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

type ImportPortfolio = Pick<Portfolio, "id" | "code" | "name">
type ImportBroker = Pick<Broker, "id" | "name" | "accountNumber">

/** One screenshot that was read, and what the user has done with it since. */
interface ImportSession {
  /** Made once per read, so a retry or a double click records once. */
  uploadId: string
  portfolio: ImportPortfolio
  proposal: ScreenshotProposal
  rows: ImportRow[]
  preview: ReconcilePreview | null
  previewByKey: Record<string, ReconcilePreviewRow>
  /** Each row's editable values as they were last checked. */
  checked: Record<string, string>
  /** The brokerage account the holdings are checked and recorded against. */
  broker: ImportBroker
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
): Promise<PreviewOutcome> {
  try {
    const res = await previewReconcile({
      portfolioId: session.portfolio.id,
      brokerId: session.broker.id,
      brokerName: session.proposal.brokerName ?? undefined,
      accountNumber: session.proposal.accountNumber ?? undefined,
      rows: sent.map(toShownHolding),
    })
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
  portfolioId: string
  choosePortfolio: (portfolioId: string) => void
  /** The brokerage account chosen; "" when none is. */
  chosenBrokerId: string
  chooseBroker: (brokerId: string) => void
  file: File | null
  /** Changes when the file input must be emptied. */
  fileInputKey: number
  chooseFile: (file: File | null) => void
  fileError: string | null
  reading: boolean
  readError: string | null
  /** The screenshot read shows transactions, which are not imported yet. */
  unsupported: boolean
  chooseAnotherFile: () => void
  read: (portfolio: ImportPortfolio, broker: ImportBroker) => Promise<void>
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
  recheck: () => Promise<void>
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
  const [chosenBrokerId, setChosenBrokerId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
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
  const recordInFlight = useRef(false)
  // Only the newest preview asked for may land.
  const latestCheck = useRef(0)

  const clearFile = (): void => {
    setFile(null)
    setFileError(null)
    setFileInputKey((key) => key + 1)
  }

  const chooseFile = (chosen: File | null): void => {
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

  const chooseAnotherFile = (): void => {
    setUnsupported(false)
    setReadError(null)
    clearFile()
  }

  const read = async (
    portfolio: ImportPortfolio,
    broker: ImportBroker,
  ): Promise<void> => {
    if (!file || readInFlight.current) return
    readInFlight.current = true
    setReading(true)
    setReadError(null)
    setUnsupported(false)
    try {
      const res = await readScreenshot(file)
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
        portfolio,
        broker,
        proposal,
        rows: toImportRows(proposal),
        preview: null,
        previewByKey: {},
        checked: {},
        tradeDate: todayIso(),
      }
      const sent = fresh.rows.filter(canBeChecked)
      const outcome = await fetchPreview(fresh, sent)
      setPreviewError("error" in outcome ? outcome.error : null)
      setRecordError(null)
      setSession(
        "preview" in outcome
          ? withPreview(fresh, sent, outcome.preview)
          : fresh,
      )
    } catch {
      setReadError(UNREACHABLE)
    } finally {
      readInFlight.current = false
      setReading(false)
    }
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
            row.key === key ? { ...row, [field]: value } : row,
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
  const brokerId = session?.broker.id ?? ""
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

  const record = async (): Promise<void> => {
    if (!session || !canRecord || recordInFlight.current) return
    recordInFlight.current = true
    setRecording(true)
    setRecordError(null)
    const confirmed: ConfirmedHoldings = {
      portfolioId: session.portfolio.id,
      brokerId,
      uploadId: session.uploadId,
      tradeDate: session.tradeDate || undefined,
      rows: readyRows,
    }
    try {
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
        brokerId,
      })
    } catch {
      setRecordError(UNREACHABLE)
    } finally {
      recordInFlight.current = false
      setRecording(false)
    }
  }

  const reset = (): void => {
    latestCheck.current++
    setSession(null)
    setResult(null)
    setChecking(false)
    setPreviewError(null)
    setRecordError(null)
    setReadError(null)
    setUnsupported(false)
    clearFile()
  }

  return {
    portfolioId,
    choosePortfolio: setPortfolioId,
    chosenBrokerId,
    chooseBroker: setChosenBrokerId,
    file,
    fileInputKey,
    chooseFile,
    fileError,
    reading,
    readError,
    unsupported,
    chooseAnotherFile,
    read,
    session,
    brokerId,
    isUnchecked,
    stale,
    checking,
    previewError,
    editRow,
    removeRow,
    recheck,
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
