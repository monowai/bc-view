import React from "react"

interface WealthSectionProps {
  title: string
  icon: string
  collapsed: boolean
  onToggle: () => void
  /** Status or qualifier beside the title. */
  note?: React.ReactNode
  /** Right-aligned link for the section. */
  action?: React.ReactNode
  /** Content runs edge to edge, for tables. */
  flush?: boolean
  children: React.ReactNode
}

/** A collapsible panel on the wealth page. */
const WealthSection: React.FC<WealthSectionProps> = ({
  title,
  icon,
  collapsed,
  onToggle,
  note,
  action,
  flush = false,
  children,
}) => (
  <section className="mb-4 rounded-lg border border-gray-200 bg-white">
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center rounded-sm text-left text-base font-semibold text-gray-900 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
        >
          <span aria-hidden="true" className="flex shrink-0 items-center">
            <i
              className={`fas fa-chevron-${collapsed ? "right" : "down"} mr-2 w-4 text-xs text-gray-400`}
            ></i>
            <span className="hidden sm:inline">
              <i className={`fas ${icon} mr-2 text-gray-400`}></i>
            </span>
          </span>
          {title}
        </button>
        {note}
      </div>
      {action}
    </div>
    {!collapsed && <div className={flush ? "" : "px-5 pb-5"}>{children}</div>}
  </section>
)

export default WealthSection
