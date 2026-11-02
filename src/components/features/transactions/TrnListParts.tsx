import React from "react"
import { NumericFormat } from "react-number-format"
import { useRouter } from "next/router"
import ConfirmDialog from "@components/ui/ConfirmDialog"

interface TrnNumberProps {
  value: number | undefined
  scale: number
  /** Pad to `scale` decimals. When false, `scale` is only a maximum. */
  fixed?: boolean
  prefix?: string
}

export function TrnNumber({
  value,
  scale,
  fixed = true,
  prefix,
}: TrnNumberProps): React.ReactElement {
  return (
    <NumericFormat
      value={value}
      displayType={"text"}
      decimalScale={scale}
      fixedDecimalScale={fixed}
      thousandSeparator={true}
      prefix={prefix}
    />
  )
}

export function TrnNumberCell({
  className = "px-4 py-3 text-right whitespace-nowrap",
  ...number
}: TrnNumberProps & { className?: string }): React.ReactElement {
  return (
    <td className={className}>
      <TrnNumber {...number} />
    </td>
  )
}

export function TrnCardValue({
  label,
  labelClassName = "text-gray-500",
  valueClassName = "ml-1 font-medium",
  ...number
}: TrnNumberProps & {
  label: string
  labelClassName?: string
  valueClassName?: string
}): React.ReactElement {
  return (
    <div>
      <span className={labelClassName}>{label}:</span>
      <span className={valueClassName}>
        <TrnNumber {...number} />
      </span>
    </div>
  )
}

export interface TrnColumn {
  label: string
  align?: "left" | "right" | "center"
}

const HEAD_ALIGN = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
}

export function TrnTableHead({
  columns,
}: {
  columns: TrnColumn[]
}): React.ReactElement {
  return (
    <thead className="bg-gray-50">
      <tr>
        {columns.map(({ label, align = "left" }) => (
          <th
            key={label}
            className={`px-4 py-3 ${HEAD_ALIGN[align]} text-xs font-medium text-gray-500 uppercase`}
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function TrnStatusBadge({
  status,
}: {
  status: string
}): React.ReactElement {
  return (
    <span
      className={`inline-block px-2 py-1 text-xs font-medium rounded ${
        status === "SETTLED"
          ? "bg-green-100 text-green-800"
          : status === "PROPOSED"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-gray-100 text-gray-800"
      }`}
    >
      {status}
    </span>
  )
}

export function TrnRowActions({
  onEdit,
  onCopy,
  onDelete,
}: {
  onEdit: () => void
  onCopy: (e: React.MouseEvent) => void
  /** Omit to hide the delete button. */
  onDelete?: () => void
}): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        className="text-gray-400 hover:text-blue-600 p-1"
        title={"Edit"}
      >
        <i className="fas fa-edit"></i>
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="text-gray-400 hover:text-gray-600 p-1"
        title={"Copy"}
      >
        <i className="fas fa-copy"></i>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-gray-400 hover:text-red-600 p-1"
          title={"Delete"}
        >
          <i className="fas fa-trash-alt"></i>
        </button>
      )}
    </div>
  )
}

export function TrnPageNav({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}): React.ReactElement {
  const router = useRouter()
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <i className="fa fa-arrow-left mr-2"></i>
            <span className="hidden sm:inline">{"Back"}</span>
          </button>
          <div className="flex-1 text-lg font-semibold text-center truncate">
            {title}
            <span className="text-gray-500 text-sm ml-2">{subtitle}</span>
          </div>
          <div className="w-16"></div>
        </div>
      </div>
    </nav>
  )
}

export function TrnEmptyState({ id }: { id?: string }): React.ReactElement {
  const router = useRouter()
  return (
    <div id={id} className="text-center py-8">
      <p className="text-gray-500 mb-4">{"No transactions found"}</p>
      <button
        onClick={() => router.back()}
        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
      >
        <i className="fa fa-arrow-left mr-2"></i>
        {"Back"}
      </button>
    </div>
  )
}

const ACTIVE_TAB =
  "px-4 py-2 font-medium border-b-2 border-blue-500 text-blue-600"
const INACTIVE_TAB =
  "px-4 py-2 font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"

export function TrnDetailTabs({
  active,
  portfolioId,
  assetId,
}: {
  active: "trades" | "events"
  portfolioId: string | undefined
  assetId: string | undefined
}): React.ReactElement {
  const router = useRouter()
  return (
    <div className="bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="flex">
          <button
            className={active === "trades" ? ACTIVE_TAB : INACTIVE_TAB}
            onClick={() =>
              router.replace(`/trns/trades/${portfolioId}/${assetId}`)
            }
          >
            {"Trades"}
          </button>
          <button
            className={active === "events" ? ACTIVE_TAB : INACTIVE_TAB}
            onClick={() =>
              router.replace(`/trns/events/${portfolioId}/${assetId}`)
            }
          >
            {"Events"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TrnDeleteConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}): React.ReactElement {
  return (
    <ConfirmDialog
      title={"Delete Transaction"}
      message={"Permanently delete this transaction?"}
      confirmLabel={"Delete"}
      cancelLabel={"Cancel"}
      variant="red"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
