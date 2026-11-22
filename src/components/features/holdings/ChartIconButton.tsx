import React from "react"

interface ChartIconButtonProps {
  ariaLabel: string
  onClick: (e: React.MouseEvent) => void
}

/**
 * Small chart glyph beside a holding's price. The price itself opens the chart
 * too; this is what tells the user it can.
 */
const ChartIconButton: React.FC<ChartIconButtonProps> = ({
  ariaLabel,
  onClick,
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    title="Open price chart"
    className="-my-1.5 -mr-1.5 ml-0 shrink-0 cursor-pointer rounded p-1.5 text-micro leading-none text-gray-500 transition-colors hover:text-wealth-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    onClick={onClick}
  >
    <i className="fas fa-chart-line" aria-hidden="true" />
  </button>
)

export default ChartIconButton
