import React from "react"
import Tooltip from "@components/ui/Tooltip"

interface ImportSectionProps {
  /** Its place in the flow, shown until the section is done. */
  step: number
  title: string
  /** More on what the section decides, behind an info icon. */
  info?: string
  /** One line on what the section decides. */
  lead: string
  done: boolean
  /** The first section not yet done: where the user is. */
  current: boolean
  children: React.ReactNode
  className?: string
}

/**
 * One section of the import flow. The numeral says where it falls in the
 * sequence; once the section is done it becomes a tick, so the user can see
 * how far the flow has come at a glance.
 */
export default function ImportSection({
  step,
  title,
  info,
  lead,
  done,
  current,
  children,
  className = "",
}: ImportSectionProps): React.ReactElement {
  const mark = done
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : current
      ? "bg-blue-50 text-blue-700 border-blue-300"
      : "bg-white text-gray-500 border-gray-300"
  return (
    <section className={`p-5 ${className}`}>
      <header className="flex items-start gap-3 mb-4">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors duration-150 ${mark}`}
        >
          {done ? <i className="fas fa-check text-xs"></i> : step}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">
            {info ? <Tooltip text={info}>{title}</Tooltip> : title}
            {done && <span className="sr-only"> (done)</span>}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{lead}</p>
        </div>
      </header>
      {children}
    </section>
  )
}
