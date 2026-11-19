import React from "react"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import {
  BC_COLUMNS,
  type BcColumn,
  DATE_FORMATS,
  type DateEvidence,
  type DateFormat,
  MAPPABLE_COLUMNS,
  TRN_TYPES,
} from "@utils/csvImport/csvMapping"
import type { TrnType } from "types/beancounter"
import {
  dateCheck,
  typeValuesIn,
  type CsvFlow,
  type CsvSession,
} from "./useCsvSession"

const selectClass =
  "border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const PREVIEW_ROWS = 8

/** Beancounter's names for its columns, in plain words. */
const COLUMN_LABEL: Partial<Record<BcColumn, string>> = {
  CallerId: "ID (updates on re-import)",
  TradeAmount: "Trade amount",
  CashAmount: "Cash amount",
  TradeCurrency: "Trade currency",
  CashCurrency: "Cash currency",
}
const labelOf = (column: BcColumn): string => COLUMN_LABEL[column] ?? column

const at = (row: string[], column: BcColumn): string =>
  row[BC_COLUMNS.indexOf(column)] ?? ""

/** One source column: its header, a sample value and the Beancounter column it feeds. */
function ColumnRow({
  csv,
  index,
  flow,
}: {
  csv: CsvSession
  index: number
  flow: CsvFlow
}): React.ReactElement {
  const header = csv.headers[index] || `Column ${index + 1}`
  const sample =
    csv.rows.find((row) => (row[index] ?? "").trim())?.[index] ?? ""
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 font-medium text-gray-900">{header}</td>
      <td className="px-3 py-2 text-gray-500 font-mono truncate max-w-[12rem]">
        {sample}
      </td>
      <td className="px-3 py-2">
        <select
          aria-label={`Beancounter column for ${header}`}
          value={csv.mapping.columns[index] ?? ""}
          onChange={(event) =>
            flow.setCsvColumn(
              index,
              (event.target.value || null) as BcColumn | null,
            )
          }
          className={selectClass}
        >
          <option value="">Ignore</option>
          {MAPPABLE_COLUMNS.map((column) => (
            <option key={column} value={column}>
              {labelOf(column)}
            </option>
          ))}
        </select>
      </td>
    </tr>
  )
}

/** What every row's date says about the format, and what the user must do about it. */
function DateNote({
  evidence,
  format,
  confirmed,
  onConfirm,
}: {
  evidence: DateEvidence
  format: DateFormat
  confirmed: boolean
  onConfirm: () => void
}): React.ReactElement | null {
  if (evidence.kind === "proven")
    return (
      <p className="text-sm text-gray-600">
        {`Dates read as ${evidence.format}: ${evidence.evidence} can only be read that way.`}
      </p>
    )
  if (evidence.kind === "conflict")
    return (
      <Alert variant="warning">
        {`${evidence.dayFirst} is day-first but ${evidence.monthFirst} is month-first. Fix the dates in the file, then import it again.`}
      </Alert>
    )
  if (evidence.kind === "ambiguous" && !confirmed)
    return (
      <Alert variant="warning">
        <p>
          Every date fits both DD/MM/YYYY and MM/DD/YYYY, so the file cannot say
          which it is. Check the dates in the preview.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-2 font-medium underline"
        >
          {`The dates are ${format}`}
        </button>
      </Alert>
    )
  return null
}

/**
 * Step 2 for a transaction CSV: how its columns map onto Beancounter's, as
 * suggested and then corrected by the user, with a preview of what Record sends.
 */
export default function CsvMappingStep({
  flow,
  onCancel,
}: {
  flow: CsvFlow
  onCancel: () => void
}): React.ReactElement | null {
  const { csv } = flow
  if (!csv) return null
  const mapped = flow.mappedRows(csv, flow.csvBrokerId || "account")
  const missing = flow.csvMissing(csv)
  const blocked = mapped.filter((row) => row.problems.length > 0)
  // Nothing is ready until the required columns are mapped.
  const ready = missing.length > 0 ? 0 : mapped.length - blocked.length
  const typeValues = csv.beancounterFormat ? [] : typeValuesIn(csv)
  const preview = [
    ...blocked,
    ...mapped.filter((row) => !row.problems.length),
  ].slice(0, PREVIEW_ROWS)
  const dates = dateCheck(csv)
  const canRecord =
    missing.length === 0 &&
    ready > 0 &&
    !dates.blocksRecord &&
    !flow.recordingCsv

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {csv.beancounterFormat ? "Check the file" : "Map the columns"}
        </h2>
        <p className="text-sm text-gray-600">
          {`${csv.fileName}: ${csv.rows.length} ${csv.rows.length === 1 ? "row" : "rows"}.`}
        </p>
        {csv.beancounterFormat ? (
          <Alert variant="info">
            This file is already in Beancounter&apos;s format, so its rows are
            recorded as they are.
          </Alert>
        ) : (
          <>
            {flow.suggestingMapping && (
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <Spinner /> Suggesting how the columns map…
              </p>
            )}
            {flow.mappingError && (
              <Alert variant="warning">{flow.mappingError}</Alert>
            )}
            <p className="text-sm text-gray-600">
              Check each column. If one is mapped wrong, choose the right
              Beancounter column for it.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Your column
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Example
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Beancounter column
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {csv.headers.map((_, index) => (
                    <ColumnRow
                      key={index}
                      csv={csv}
                      index={index}
                      flow={flow}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                Date format
                <select
                  value={csv.mapping.dateFormat}
                  onChange={(event) =>
                    flow.setCsvDateFormat(event.target.value as DateFormat)
                  }
                  className={selectClass}
                >
                  {DATE_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </label>
              {!csv.mapping.columns.includes("Market") && (
                <label className="flex items-center gap-2">
                  Market for every row
                  <input
                    value={csv.mapping.market}
                    onChange={(event) => flow.setCsvMarket(event.target.value)}
                    placeholder="US"
                    className={`${selectClass} w-24 uppercase`}
                  />
                </label>
              )}
            </div>
            <DateNote
              evidence={dates.evidence}
              format={csv.mapping.dateFormat}
              confirmed={csv.dateConfirmed}
              onConfirm={() => flow.setCsvDateFormat(csv.mapping.dateFormat)}
            />
            {typeValues.length > 0 && (
              <div className="text-sm">
                <h3 className="font-semibold text-gray-900">
                  Transaction types
                </h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {typeValues.map((value) => (
                    <li key={value} className="flex items-center gap-2">
                      <span className="w-40 truncate font-mono">
                        {value || "(blank)"}
                      </span>
                      <select
                        aria-label={`Type for ${value}`}
                        value={csv.mapping.typeValues[value] ?? ""}
                        onChange={(event) =>
                          flow.setCsvTypeValue(
                            value,
                            event.target.value as TrnType | "",
                          )
                        }
                        className={selectClass}
                      >
                        <option value="">Choose…</option>
                        {TRN_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {missing.length > 0 && (
              <Alert variant="warning">
                <ul>
                  {missing.map((column) => (
                    <li key={column}>
                      {column === "Market"
                        ? "Map a column to Market, or enter the market for every row"
                        : `Map a column to ${column}`}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </>
        )}
      </section>

      <section
        aria-label="What will be recorded"
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3 text-sm"
      >
        <h3 className="font-semibold text-gray-900">What will be recorded</h3>
        {missing.length > 0 ? (
          <p className="text-gray-600">
            Map the required columns to see the rows as Beancounter will read
            them.
          </p>
        ) : (
          <>
            <p className="text-gray-700">
              {`${ready} ${ready === 1 ? "row" : "rows"} ready`}
              {blocked.length > 0 &&
                ` · ${blocked.length} ${blocked.length === 1 ? "row" : "rows"} will not be recorded`}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <tr>
                    {[
                      "Date",
                      "Type",
                      "Market",
                      "Code",
                      "Quantity",
                      "Price",
                      "",
                    ].map((label) => (
                      <th key={label} scope="col" className="px-3 py-2">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {preview.map((row, index) => (
                    <tr key={index} className="border-t border-gray-100">
                      <td className="px-3 py-1.5">{at(row.values, "Date")}</td>
                      <td className="px-3 py-1.5">{at(row.values, "Type")}</td>
                      <td className="px-3 py-1.5">
                        {at(row.values, "Market")}
                      </td>
                      <td className="px-3 py-1.5">{at(row.values, "Code")}</td>
                      <td className="px-3 py-1.5 text-right">
                        {at(row.values, "Quantity")}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {at(row.values, "Price")}
                      </td>
                      <td className="px-3 py-1.5 font-sans text-amber-700">
                        {row.problems.map((problem) => (
                          <span key={problem} className="block">
                            {problem}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {flow.csvRecordError && <Alert>{flow.csvRecordError}</Alert>}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={() => void flow.recordCsv()}
            disabled={!canRecord}
            className="btn-primary disabled:opacity-50"
          >
            {flow.recordingCsv
              ? "Recording…"
              : `Record ${ready} ${ready === 1 ? "Transaction" : "Transactions"}`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={flow.recordingCsv}
            className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            Start Again
          </button>
        </div>
      </section>
    </div>
  )
}
