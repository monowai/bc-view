import React from "react"
import Link from "next/link"
import type {
  ReportFinding,
  ReportKpi,
  ReportRow,
} from "@lib/independence/report/buildReport"

/**
 * Building blocks shared by the plan report and the journey report, so the
 * two print the same way.
 */
const SEVERITY: Record<
  ReportFinding["severity"],
  { icon: string; color: string; label: string }
> = {
  CRITICAL: {
    icon: "fa-circle-exclamation",
    color: "text-red-600",
    label: "Critical",
  },
  WARNING: {
    icon: "fa-triangle-exclamation",
    color: "text-amber-600",
    label: "Warning",
  },
  POSITIVE: {
    icon: "fa-circle-check",
    color: "text-green-600",
    label: "Positive",
  },
  INFO: { icon: "fa-circle-info", color: "text-gray-500", label: "Note" },
}

/** Privacy mode hides money, not the shape of the report. */
const MONEY_PATTERNS = new Map<string, RegExp>()
function moneyPattern(symbol: string): RegExp {
  let re = MONEY_PATTERNS.get(symbol)
  if (!re) {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    re = new RegExp(`-?${escaped}[\\d,.]+[mk]?`, "g")
    MONEY_PATTERNS.set(symbol, re)
  }
  return re
}
export function maskMoney(text: string, symbol: string, hide: boolean): string {
  if (!hide) return text
  return text.replace(moneyPattern(symbol), "•••")
}

export function Section({
  id,
  title,
  children,
  breakBefore = false,
}: {
  id: string
  title: string
  children: React.ReactNode
  breakBefore?: boolean
}): React.ReactElement {
  return (
    <section
      data-testid={`report-${id}`}
      className={`report-section rounded-lg border border-gray-200 bg-white p-5 ${
        breakBefore ? "report-break" : ""
      }`}
    >
      <h2 className="mb-2 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

export function Kpis({
  kpis,
  symbol,
  hide,
}: {
  kpis: ReportKpi[]
  symbol: string
  hide: boolean
}): React.ReactElement {
  return (
    <dl className="report-keep my-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            {k.label}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {maskMoney(k.value, symbol, hide)}
          </dd>
          <dd className="text-xs text-gray-600">
            {maskMoney(k.caption, symbol, hide)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Rows({
  rows,
  symbol,
  hide,
}: {
  rows: ReportRow[]
  symbol: string
  hide: boolean
}): React.ReactElement {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-gray-100">
            <td className="py-1 pr-3 text-gray-600">{r.label}</td>
            <td className="py-1 text-right tabular-nums text-gray-900">
              {maskMoney(r.value, symbol, hide)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Progress toward the independence number. Label and bar share one clamp. */
export function FiProgressBar({
  fiProgress,
}: {
  fiProgress: number
}): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, Math.round(fiProgress)))
  return (
    <div className="my-2">
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>Independence number progress</span>
        <span data-testid="report-fi-label" className="tabular-nums">
          {clamped}%
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded bg-gray-100">
        <div
          data-testid="report-fi-bar"
          className={`h-full ${clamped >= 100 ? "bg-green-500" : "bg-independence-500"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

export function FindingsList({
  findings,
  mask,
}: {
  findings: ReportFinding[]
  mask: (s: string) => string
}): React.ReactElement {
  return (
    <ul className="divide-y divide-gray-100">
      {findings.map((f) => {
        const s = SEVERITY[f.severity]
        return (
          <li key={f.code} className="report-keep flex gap-3 py-2">
            <i
              className={`fas ${s.icon} ${s.color} mt-0.5`}
              aria-hidden="true"
            />
            <span
              className={`w-16 shrink-0 text-xs font-semibold uppercase ${s.color}`}
            >
              {s.label}
            </span>
            <span>
              <span className="font-medium">{f.title}</span>
              {f.tag && (
                <span className="ml-2 rounded border border-gray-300 px-1 text-[10px] text-gray-500 align-middle">
                  {f.tag}
                </span>
              )}
              <div className="text-gray-600">{mask(f.detail)}</div>
              {f.gloss && (
                <div className="text-xs text-gray-500">{f.gloss}</div>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function ReportToolbar({
  backHref,
  backLabel,
}: {
  backHref: string
  backLabel: string
}): React.ReactElement {
  return (
    <div className="report-toolbar flex items-center justify-between print:hidden">
      <Link
        href={backHref}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        <i className="fas fa-arrow-left mr-1" aria-hidden="true" />
        {backLabel}
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
      >
        <i className="fas fa-print mr-1" aria-hidden="true" />
        Print / Save PDF
      </button>
    </div>
  )
}
