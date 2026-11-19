import type { TrnType } from "types/beancounter"

/**
 * Beancounter's transaction CSV columns, in order: svc-data's
 * `TrnIoDefinition.Columns`. A row sent to the trn import is read by position.
 */
export const BC_COLUMNS = [
  "Batch",
  "CallerId",
  "Type",
  "Market",
  "Code",
  "Name",
  "CashAccount",
  "CashCurrency",
  "Date",
  "Quantity",
  "BaseRate",
  "TradeCurrency",
  "Price",
  "Fees",
  "PortfolioRate",
  "TradeAmount",
  "CashAmount",
  "Comments",
  "Status",
  "Broker",
  "SubAccounts",
  "CostDate",
] as const

export type BcColumn = (typeof BC_COLUMNS)[number]

/** The columns a user's own file can supply; the rest the import fills in. */
export const MAPPABLE_COLUMNS: BcColumn[] = [
  "Date",
  "Type",
  "Code",
  "Market",
  "Name",
  "Quantity",
  "Price",
  "Fees",
  "TradeAmount",
  "CashAmount",
  "TradeCurrency",
  "CashCurrency",
  "Comments",
]

const REQUIRED: BcColumn[] = ["Date", "Type", "Code", "Market", "Quantity"]

export const TRN_TYPES: TrnType[] = [
  "BUY",
  "SELL",
  "ADD",
  "REDUCE",
  "DIVI",
  "SPLIT",
  "DEPOSIT",
  "WITHDRAWAL",
  "INCOME",
  "EXPENSE",
  "DEDUCTION",
  "FX_BUY",
  "BALANCE",
  "COST_ADJUST",
]

/** When no mapping can be suggested, from the server or the browser. */
export const COULD_NOT_SUGGEST =
  "Could not suggest how this file maps. Map the columns yourself."

export const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"] as const
export type DateFormat = (typeof DATE_FORMATS)[number]

/** How a user's file maps onto Beancounter's columns. */
export interface CsvMapping {
  /** The Beancounter column each source column feeds, by position; null to ignore it. */
  columns: Array<BcColumn | null>
  /** Each value in the source type column, mapped to a transaction type. */
  typeValues: Record<string, TrnType>
  dateFormat: DateFormat
  /** Market for every row when no column supplies one; "" when none is chosen. */
  market: string
}

export interface MappedRow {
  /** One value per Beancounter column, in `BC_COLUMNS` order. */
  values: string[]
  /** Why the row cannot be recorded; empty when it can. */
  problems: string[]
}

interface MappingContext {
  /** Shared by every row of one import, so its rows can be found together. */
  batch: string
  /** The brokerage account the rows belong to. */
  brokerId: string
  /** yyyy-mm-dd; svc-data refuses a later trade date. */
  today: string
}

const normalise = (value: string): string => value.trim().toLowerCase()

/** True when the header row is Beancounter's own format, so nothing needs mapping. */
export function isBeancounterHeader(headers: string[]): boolean {
  const required = BC_COLUMNS.indexOf("Comments") + 1
  if (headers.length < required) return false
  return headers.every(
    (header, index) =>
      index >= BC_COLUMNS.length ||
      normalise(header) === normalise(BC_COLUMNS[index]),
  )
}

/** The required columns a mapping does not yet supply. */
export function missingRequired(mapping: CsvMapping): BcColumn[] {
  return REQUIRED.filter(
    (column) =>
      !mapping.columns.includes(column) &&
      !(column === "Market" && mapping.market.trim()),
  )
}

const pad = (value: number): string => String(value).padStart(2, "0")

/** yyyy-mm-dd for a real calendar date in [format], else null. */
export function readDate(value: string, format: DateFormat): string | null {
  const parts = value.trim().split(/[-/.]/).map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part)))
    return null
  const [year, month, day] =
    format === "YYYY-MM-DD"
      ? parts
      : format === "DD/MM/YYYY"
        ? [parts[2], parts[1], parts[0]]
        : [parts[2], parts[0], parts[1]]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    year < 1900 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null
  return `${year}-${pad(month)}-${pad(day)}`
}

const NUMERIC: BcColumn[] = [
  "Quantity",
  "Price",
  "Fees",
  "TradeAmount",
  "CashAmount",
]

/** Digits with an optional sign, comma thousands groups and a point decimal. */
const NUMBER = /^-?(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/

/**
 * A number as svc-data parses it: no currency signs, spaces or thousands
 * separators. Null when what is left is not one number, such as a decimal
 * comma ("1,23") or "1.234.56", so the row is stopped rather than misread.
 */
function cleanNumber(value: string): string | null {
  const bare = value.replace(/[^0-9.,\-]/g, "")
  if (!bare) return ""
  return NUMBER.test(bare) ? bare.replaceAll(",", "") : null
}

/** One source row in Beancounter's column order, with what stops it recording. */
function mapRow(
  source: string[],
  index: number,
  mapping: CsvMapping,
  { batch, brokerId, today }: MappingContext,
): MappedRow {
  const values = BC_COLUMNS.map(() => "")
  const set = (column: BcColumn, value: string): void => {
    values[BC_COLUMNS.indexOf(column)] = value
  }
  const shown = (column: BcColumn): string | null => {
    const at = mapping.columns.indexOf(column)
    return at < 0 ? null : (source[at] ?? "").trim()
  }
  const problems: string[] = []
  mapping.columns.forEach((column, at) => {
    if (!column) return
    const value = (source[at] ?? "").trim()
    const written = NUMERIC.includes(column) ? cleanNumber(value) : value
    if (written === null) problems.push(`"${value}" is not a number`)
    else set(column, written)
  })
  set("Batch", batch)
  set("CallerId", `${batch}-${index + 1}`)
  set("Broker", brokerId)
  if (shown("Market") === null) set("Market", mapping.market.trim())

  const typeShown = shown("Type")
  if (typeShown !== null) {
    const type = mapping.typeValues[typeShown]
    if (type) set("Type", type)
    else problems.push(`No type for "${typeShown}"`)
  }
  const dateShown = shown("Date")
  if (dateShown !== null) {
    const date = readDate(dateShown, mapping.dateFormat)
    if (!date)
      problems.push(`"${dateShown}" is not a ${mapping.dateFormat} date`)
    else if (date > today) problems.push(`${date} is after today`)
    else set("Date", date)
  }
  return { values, problems }
}

/** Each source row written in Beancounter's column order, with what stops it recording. */
export function applyMapping(
  rows: string[][],
  mapping: CsvMapping,
  context: MappingContext,
): MappedRow[] {
  return rows.map((source, index) => mapRow(source, index, mapping, context))
}

const isColumn = (value: unknown): value is BcColumn =>
  typeof value === "string" && MAPPABLE_COLUMNS.includes(value as BcColumn)

/**
 * A model's mapping reply, checked: unknown columns and types are dropped, a
 * column is mapped at most once, and the column list matches the header count.
 * Null when the reply is not a mapping at all.
 */
export function parseMappingReply(
  reply: unknown,
  headerCount: number,
): CsvMapping | null {
  if (!reply || typeof reply !== "object") return null
  const { columns, typeValues, dateFormat, market } = reply as Record<
    string,
    unknown
  >
  if (!Array.isArray(columns)) return null
  if (!DATE_FORMATS.includes(dateFormat as DateFormat)) return null
  const used = new Set<BcColumn>()
  const mapped = Array.from({ length: headerCount }, (_, index) => {
    const column = columns[index]
    if (!isColumn(column) || used.has(column)) return null
    used.add(column)
    return column
  })
  const types =
    typeValues && typeof typeValues === "object"
      ? Object.fromEntries(
          Object.entries(typeValues as Record<string, unknown>).filter(
            (entry): entry is [string, TrnType] =>
              TRN_TYPES.includes(entry[1] as TrnType),
          ),
        )
      : {}
  return {
    columns: mapped,
    typeValues: types,
    dateFormat: dateFormat as DateFormat,
    market: typeof market === "string" ? market : "",
  }
}
