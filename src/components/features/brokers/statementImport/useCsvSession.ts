import { useRef, useState } from "react"
import Papa from "papaparse"
import { suggestCsvMapping } from "@utils/api/client/brokers"
import { portfolioKey } from "@utils/api/client/portfolios"
import { importTrnRow } from "@utils/api/client/trns"
import { readServerMessage } from "@utils/api/client/request"
import { todayIso } from "@utils/formatters"
import { readFileText } from "@utils/readFileText"
import {
  applyMapping,
  BC_COLUMNS,
  COULD_NOT_SUGGEST,
  type BcColumn,
  type CsvMapping,
  type DateFormat,
  isBeancounterHeader,
  type MappedRow,
  missingRequired,
} from "@utils/csvImport/csvMapping"
import { MAX_SAMPLE_ROWS } from "@utils/csvImport/mappingPrompt"
import type { Portfolio, TrnType } from "types/beancounter"
import type { ImportAccount } from "./newAccount"
import type { ImportTarget } from "./useStatementImport"

type ImportPortfolio = Pick<Portfolio, "id" | "code" | "name">

/** Where a CSV's rows are recorded: the choices made on the upload step. */
export interface CsvTarget {
  uploadId: string
  target: ImportTarget
  account: ImportAccount
}

/** One transaction CSV that was read, and what the user has done with it since. */
export interface CsvSession {
  uploadId: string
  fileName: string
  headers: string[]
  rows: string[][]
  /** The file is already in Beancounter's format: rows go as they are. */
  beancounterFormat: boolean
  mapping: CsvMapping
}

/** What recording a CSV needs from the rest of the import. */
interface CsvRecordDeps {
  /** The brokerage account's id, creating it first when asked to; null on failure. */
  accountFor: (current: CsvTarget) => Promise<string | null>
  /** The portfolio, creating it first when asked to; null on failure. */
  portfolioFor: (current: CsvTarget) => Promise<ImportPortfolio | null>
  onRecorded: (outcome: {
    recorded: number
    warnings: string[]
    brokerId: string
    portfolio: ImportPortfolio
    loadFrom: string
  }) => void
}

export const isCsvFile = (file: File): boolean =>
  file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")

const emptyMapping = (columnCount: number): CsvMapping => ({
  columns: Array.from({ length: columnCount }, () => null),
  typeValues: {},
  dateFormat: "YYYY-MM-DD",
  market: "",
})

/** The header row and the data rows, skipping blank and # comment lines. */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const parsed = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: true,
  }).data
  const [headers = [], ...rest] = parsed
  return {
    headers: headers.map((header) => header.trim()),
    rows: rest.filter(
      (row) => row.some((cell) => cell.trim()) && !row[0]?.startsWith("#"),
    ),
  }
}

const BROKER_AT = BC_COLUMNS.indexOf("Broker")

/** A Beancounter-format row as it is, with the brokerage account filled in where it names none. */
function withBroker(row: string[], brokerId: string): string[] {
  if ((row[BROKER_AT] ?? "").trim()) return row
  const filled = [...row]
  while (filled.length < BROKER_AT) filled.push("")
  filled[BROKER_AT] = brokerId
  return filled
}

/** The distinct values of the column mapped to Type, in the order they appear. */
export function typeValuesIn(session: CsvSession): string[] {
  const at = session.mapping.columns.indexOf("Type")
  if (at < 0) return []
  return [...new Set(session.rows.map((row) => (row[at] ?? "").trim()))]
}

/**
 * A transaction CSV in the brokerage import: read it, suggest how its columns
 * map (unless it is already Beancounter's format), let the user correct the
 * mapping, then send each row through the trn import.
 */
/** The CSV path's state and actions, as the mapping step uses them. */
export interface CsvFlow {
  csv: CsvSession | null
  readCsv: (
    file: File,
    target: ImportTarget,
    account: ImportAccount,
  ) => Promise<void>
  suggestingMapping: boolean
  mappingError: string | null
  setCsvColumn: (index: number, column: BcColumn | null) => void
  setCsvTypeValue: (value: string, type: TrnType | "") => void
  setCsvDateFormat: (dateFormat: DateFormat) => void
  setCsvMarket: (market: string) => void
  mappedRows: (session: CsvSession, brokerId: string) => MappedRow[]
  csvMissing: (session: CsvSession) => BcColumn[]
  recordCsv: () => Promise<void>
  recordingCsv: boolean
  csvRecordError: string | null
  resetCsv: () => void
  /** The brokerage account chosen for the CSV; "" while one is to be created. */
  csvBrokerId: string
}

export function useCsvSession(deps: CsvRecordDeps): CsvFlow {
  const [csv, setCsv] = useState<CsvSession | null>(null)
  // The upload step's choices for the CSV on screen.
  const [csvTarget, setCsvTarget] = useState<CsvTarget | null>(null)
  const [suggestingMapping, setSuggestingMapping] = useState(false)
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [recordingCsv, setRecordingCsv] = useState(false)
  const [csvRecordError, setCsvRecordError] = useState<string | null>(null)
  const recordInFlight = useRef(false)
  // Kept once made, so a retry does not create the account or portfolio again.
  const resolved = useRef<{ accountId?: string; portfolio?: ImportPortfolio }>(
    {},
  )

  const today = todayIso()
  const readCsv = async (
    file: File,
    target: ImportTarget,
    account: ImportAccount,
  ): Promise<void> => {
    let text: string
    try {
      text = await readFileText(file)
    } catch {
      setMappingError("The file could not be read. Choose it again.")
      return
    }
    const { headers, rows } = parseCsv(text)
    const beancounterFormat = isBeancounterHeader(headers)
    resolved.current = {}
    setCsvRecordError(null)
    setMappingError(null)
    const session: CsvSession = {
      uploadId: crypto.randomUUID(),
      fileName: file.name,
      headers,
      rows,
      beancounterFormat,
      mapping: emptyMapping(headers.length),
    }
    setCsv(session)
    setCsvTarget({ uploadId: session.uploadId, target, account })
    if (beancounterFormat || headers.length === 0) return
    setSuggestingMapping(true)
    try {
      const res = await suggestCsvMapping(
        headers,
        rows.slice(0, MAX_SAMPLE_ROWS),
      )
      if (!res.ok) {
        setMappingError((await readServerMessage(res)) || COULD_NOT_SUGGEST)
        return
      }
      const { data } = (await res.json()) as { data: CsvMapping }
      setCsv((current) =>
        current?.uploadId === session.uploadId
          ? { ...current, mapping: data }
          : current,
      )
    } catch {
      setMappingError(COULD_NOT_SUGGEST)
    } finally {
      setSuggestingMapping(false)
    }
  }

  const updateMapping = (change: (mapping: CsvMapping) => CsvMapping): void =>
    setCsv(
      (current) => current && { ...current, mapping: change(current.mapping) },
    )

  /** Point one source column at a Beancounter column; a column feeds at most one. */
  const setCsvColumn = (index: number, column: BcColumn | null): void =>
    updateMapping((mapping) => ({
      ...mapping,
      columns: mapping.columns.map((current, at) =>
        at === index ? column : current === column ? null : current,
      ),
    }))

  const setCsvTypeValue = (value: string, type: TrnType | ""): void =>
    updateMapping((mapping) => {
      const typeValues = { ...mapping.typeValues }
      if (type) typeValues[value] = type
      else delete typeValues[value]
      return { ...mapping, typeValues }
    })

  const setCsvDateFormat = (dateFormat: DateFormat): void =>
    updateMapping((mapping) => ({ ...mapping, dateFormat }))

  const setCsvMarket = (market: string): void =>
    updateMapping((mapping) => ({ ...mapping, market: market.toUpperCase() }))

  /** Each row as it would be sent, with what stops it. */
  const mappedRows = (session: CsvSession, brokerId: string): MappedRow[] =>
    session.beancounterFormat
      ? session.rows.map((row) => ({
          values: withBroker(row, brokerId),
          problems: [],
        }))
      : applyMapping(session.rows, session.mapping, {
          batch: session.uploadId.slice(0, 8),
          brokerId,
          today,
        })

  const csvMissing = (session: CsvSession): BcColumn[] =>
    session.beancounterFormat ? [] : missingRequired(session.mapping)

  const recordCsv = async (): Promise<void> => {
    const current = csvTarget
    if (!csv || !current || recordInFlight.current) return
    recordInFlight.current = true
    setRecordingCsv(true)
    setCsvRecordError(null)
    try {
      const accountId =
        resolved.current.accountId ?? (await deps.accountFor(current))
      if (!accountId) return
      resolved.current.accountId = accountId
      const target =
        resolved.current.portfolio ?? (await deps.portfolioFor(current))
      if (!target) return
      resolved.current.portfolio = target
      // svc-data reads the owner from the portfolio the row carries.
      const portfolioRes = await fetch(portfolioKey(target.id))
      if (!portfolioRes.ok) {
        setCsvRecordError(
          (await readServerMessage(portfolioRes)) ||
            `The portfolio could not be read (error ${portfolioRes.status}). Nothing was recorded.`,
        )
        return
      }
      const portfolio = ((await portfolioRes.json()) as { data: Portfolio })
        .data
      const ready = mappedRows(csv, accountId).filter(
        (row) => row.problems.length === 0,
      )
      const warnings: string[] = []
      let recorded = 0
      for (const row of ready) {
        const res = await importTrnRow({
          hasHeader: true,
          portfolio,
          purge: false,
          row: row.values,
        })
        if (res.ok) recorded++
        else
          warnings.push(
            `${row.values[BC_COLUMNS.indexOf("Code")]} on ${row.values[BC_COLUMNS.indexOf("Date")]}: not sent (error ${res.status})`,
          )
      }
      const dates = ready
        .map((row) => row.values[BC_COLUMNS.indexOf("Date")])
        .filter(Boolean)
        .sort()
      deps.onRecorded({
        recorded,
        warnings,
        brokerId: accountId,
        portfolio: target,
        loadFrom: dates[0] ?? today,
      })
    } catch {
      setCsvRecordError(
        "Beancounter could not be reached. Some rows may not have been sent; check the portfolio before trying again.",
      )
    } finally {
      recordInFlight.current = false
      setRecordingCsv(false)
    }
  }

  const resetCsv = (): void => {
    setCsv(null)
    setCsvTarget(null)
    setMappingError(null)
    setCsvRecordError(null)
    resolved.current = {}
  }

  return {
    csv,
    readCsv,
    suggestingMapping,
    mappingError,
    setCsvColumn,
    setCsvTypeValue,
    setCsvDateFormat,
    setCsvMarket,
    mappedRows,
    csvMissing,
    recordCsv,
    recordingCsv,
    csvRecordError,
    resetCsv,
    csvBrokerId:
      csvTarget && "broker" in csvTarget.account
        ? csvTarget.account.broker.id
        : "",
  }
}
