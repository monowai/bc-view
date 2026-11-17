import React from "react"
import useSwr from "swr"
import { marketsKey, simpleFetcher } from "@utils/api/fetchHelper"
import { formatCurrency, formatQuantity } from "@utils/formatters"
import type { Market, ReconcilePreviewRow } from "types/beancounter"
import {
  describeChange,
  ImportRow,
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
}

const inputClass =
  "w-full border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const cellClass = "px-2 py-2 align-top"

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
}: HoldingsTableProps): React.ReactElement {
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
              Cost of holding
            </th>
            <th scope="col" className="px-2 py-2">
              Status
            </th>
            <th scope="col" className="px-2 py-2">
              <span className="sr-only">Remove</span>
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
            const recordable = preview?.status === "READY"
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
                    <>
                      <span className="font-medium text-gray-900">
                        {describeChange(preview)}
                      </span>
                      {preview.trnType === "ADD" && preview.cost != null && (
                        <span className="block text-xs text-gray-500">
                          {`at a cost of ${formatCurrency(preview.cost)}`}
                        </span>
                      )}
                    </>
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
                  <span
                    className={
                      recordable
                        ? "text-green-700"
                        : preview?.status === "UNCHANGED"
                          ? "text-gray-600"
                          : "text-amber-700"
                    }
                  >
                    {checking && !preview && row.code.trim()
                      ? "Checking…"
                      : rowStatus(
                          row,
                          preview,
                          unchecked,
                          row.key in previewByKey,
                        )}
                  </span>
                  {preview?.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="block text-xs text-amber-700 mt-1"
                    >
                      {WARNING_COPY[warning]}
                    </span>
                  ))}
                </td>
                <td className={cellClass}>
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
