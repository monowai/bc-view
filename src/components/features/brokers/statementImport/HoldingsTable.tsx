import React from "react"
import useSwr from "swr"
import { marketsKey, simpleFetcher } from "@utils/api/fetchHelper"
import { formatQuantity, todayIso } from "@utils/formatters"
import type { Market, ReconcilePreviewRow } from "types/beancounter"
import {
  chooseAmong,
  describeChange,
  ImportRow,
  MARKET_SOURCE_COPY,
  NEEDS_CODE,
  NEVER_CHECKED,
  NOT_CHECKED,
  rowName,
  STATUS_COPY,
  WARNING_COPY,
} from "./statementRows"

type EditableField = "code" | "market" | "quantity" | "cost"

interface HoldingsTableProps {
  rows: ImportRow[]
  previewByKey: Record<string, ReconcilePreviewRow>
  isUnchecked: (row: ImportRow) => boolean
  checking: boolean
  disabled: boolean
  onEdit: (key: string, field: EditableField, value: string) => void
  onRemove: (key: string) => void
  onRecheck: (key: string) => void
  /** Look the row's asset up with the asset search. */
  onFind: (key: string) => void
  /** Set when an added holding was opened. */
  onHeldSince: (key: string, heldSince: string) => void
  /** The import's held-since date, used by rows without their own. */
  importHeldSince: string
}

const inputClass =
  "w-full border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const cellClass = "px-2 py-2 align-top"

/** Statuses about the asset itself, which the asset search can resolve. */
const ASSET_ISSUES = new Set(["UNRESOLVED", "NEEDS_MARKET"])

/**
 * Where an added holding's held-since date comes from: the image, a guess, or
 * the import's date when the row has none of its own.
 */
function heldSinceNote(row: ImportRow, importHeldSince: string): string {
  if (row.heldSince) return row.heldSinceHint ?? ""
  return importHeldSince ? `Import's date, ${importHeldSince}` : ""
}

/**
 * A row's status: a green tick when it is good, a ? that opens the asset
 * search when the asset is the problem, otherwise what is missing. The words
 * stay for assistive technology and as the tooltip.
 */
function RowStatusCell({
  name,
  preview,
  text,
  disabled,
  onFind,
}: {
  name: string
  preview: ReconcilePreviewRow | undefined
  text: string
  disabled: boolean
  onFind: () => void
}): React.ReactElement {
  if (preview?.status === "READY" || preview?.status === "UNCHANGED") {
    return (
      <span className="text-green-600" title={text}>
        <i className="fas fa-circle-check text-lg" aria-hidden="true"></i>
        <span className="sr-only">{text}</span>
      </span>
    )
  }
  if (preview && ASSET_ISSUES.has(preview.status)) {
    return (
      <button
        type="button"
        aria-label={`Search for ${name}`}
        title={text}
        disabled={disabled}
        onClick={onFind}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold hover:bg-amber-200 disabled:opacity-50"
      >
        ?<span className="sr-only">{text}</span>
      </button>
    )
  }
  return <span className="text-amber-700">{text}</span>
}

/** What a row's last check said, or why there is nothing to say yet. */
export function rowStatus(
  row: ImportRow,
  preview: ReconcilePreviewRow | undefined,
  unchecked: boolean,
  /** Some check has answered for this row, though maybe not for its values now. */
  everChecked: boolean,
): string {
  if (!row.code.trim()) return NEEDS_CODE
  if (!everChecked) return NEVER_CHECKED
  if (unchecked || !preview) return NOT_CHECKED
  const listedOn = preview.listedOn ?? []
  if (preview.status === "NEEDS_MARKET" && listedOn.length > 1)
    return chooseAmong(listedOn)
  return STATUS_COPY[preview.status]
}

/**
 * One editable row per holding on the screenshot, beside what is held and the
 * change that would bring the two into line. Typing asks the server nothing.
 */
export default function HoldingsTable({
  rows,
  previewByKey,
  isUnchecked,
  checking,
  disabled,
  onEdit,
  onRemove,
  onRecheck,
  onFind,
  onHeldSince,
  importHeldSince,
}: HoldingsTableProps): React.ReactElement {
  const today = todayIso()
  const { data } = useSwr<{ data: Market[] }>(
    marketsKey,
    simpleFetcher(marketsKey),
    { revalidateOnFocus: false },
  )
  const marketCodes = (data?.data ?? []).map((market) => market.code)

  if (rows.length === 0) {
    return (
      <p className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
        No holdings are left to check.
      </p>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">Holdings read from the screenshot</caption>
        <thead className="bg-gray-50 text-left text-xs text-gray-600">
          <tr>
            <th scope="col" className="px-2 py-2">
              Code
            </th>
            <th scope="col" className="px-2 py-2">
              Market
            </th>
            <th scope="col" className="px-2 py-2">
              Quantity shown
            </th>
            <th scope="col" className="px-2 py-2 text-right">
              Held
            </th>
            <th scope="col" className="px-2 py-2">
              Change
            </th>
            <th scope="col" className="px-2 py-2">
              Held since
            </th>
            <th scope="col" className="px-2 py-2">
              Cost of holding
            </th>
            <th scope="col" className="px-2 py-2">
              Status
            </th>
            <th scope="col" className="px-2 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, index) => {
            const name = rowName(row, index)
            const unchecked = isUnchecked(row)
            const preview = unchecked ? undefined : previewByKey[row.key]
            const options =
              row.market && !marketCodes.includes(row.market)
                ? [row.market, ...marketCodes]
                : marketCodes
            return (
              <tr key={row.key}>
                <td className={cellClass}>
                  <input
                    type="text"
                    aria-label={`Code for ${name}`}
                    value={row.code}
                    disabled={disabled}
                    onChange={(event) =>
                      onEdit(row.key, "code", event.target.value)
                    }
                    className={`${inputClass} w-24 uppercase`}
                  />
                  {(preview?.assetName || row.name) && (
                    <span className="block text-xs text-gray-500 mt-1">
                      {preview?.assetName || row.name}
                    </span>
                  )}
                </td>
                <td className={cellClass}>
                  <select
                    aria-label={`Market for ${name}`}
                    value={row.market}
                    disabled={disabled}
                    onChange={(event) =>
                      onEdit(row.key, "market", event.target.value)
                    }
                    className={`${inputClass} w-28`}
                  >
                    <option value="">Choose…</option>
                    {options.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  {row.marketFrom && MARKET_SOURCE_COPY[row.marketFrom] && (
                    <span className="block text-xs text-gray-500 mt-1">
                      {MARKET_SOURCE_COPY[row.marketFrom]}
                    </span>
                  )}
                </td>
                <td className={cellClass}>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Quantity for ${name}`}
                    value={row.quantity}
                    disabled={disabled}
                    onChange={(event) =>
                      onEdit(row.key, "quantity", event.target.value)
                    }
                    className={`${inputClass} w-28 text-right`}
                  />
                </td>
                <td className={`${cellClass} text-right tabular-nums`}>
                  {preview ? formatQuantity(preview.held) : ""}
                </td>
                <td className={cellClass}>
                  {preview && (
                    <span className="font-medium text-gray-900">
                      {describeChange(preview)}
                    </span>
                  )}
                </td>
                <td className={cellClass}>
                  {preview?.trnType === "ADD" ? (
                    <>
                      <input
                        type="date"
                        aria-label={`Held since for ${name}`}
                        value={row.heldSince}
                        max={today}
                        disabled={disabled}
                        onChange={(event) =>
                          onHeldSince(row.key, event.target.value)
                        }
                        className={`${inputClass} w-36`}
                      />
                      {heldSinceNote(row, importHeldSince) && (
                        <span className="block text-xs text-gray-500 mt-1">
                          {heldSinceNote(row, importHeldSince)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400" aria-hidden="true">
                      —
                    </span>
                  )}
                </td>
                <td className={cellClass}>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Cost for ${name}`}
                    value={row.cost}
                    disabled={disabled}
                    onChange={(event) =>
                      onEdit(row.key, "cost", event.target.value)
                    }
                    className={`${inputClass} w-32 text-right`}
                  />
                </td>
                <td className={cellClass}>
                  <RowStatusCell
                    name={name}
                    preview={preview}
                    text={
                      checking && !preview && row.code.trim()
                        ? "Checking…"
                        : rowStatus(
                            row,
                            preview,
                            unchecked,
                            row.key in previewByKey,
                          )
                    }
                    disabled={disabled || checking}
                    onFind={() => onFind(row.key)}
                  />
                  {preview?.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="block text-xs text-amber-700 mt-1"
                    >
                      {WARNING_COPY[warning]}
                    </span>
                  ))}
                </td>
                <td className={`${cellClass} whitespace-nowrap`}>
                  <button
                    type="button"
                    aria-label={`Recheck ${name}`}
                    title="Recheck this row"
                    disabled={disabled || checking || !row.code.trim()}
                    onClick={() => onRecheck(row.key)}
                    className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-40"
                  >
                    <i className="fas fa-rotate-right" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    title={`Remove ${name}`}
                    disabled={disabled}
                    onClick={() => onRemove(row.key)}
                    className="text-gray-400 hover:text-red-600 p-1"
                  >
                    <i className="far fa-trash-alt" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
