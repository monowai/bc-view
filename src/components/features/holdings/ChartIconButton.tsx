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
    className="ml-1 shrink-0 text-[10px] leading-none text-gray-400 hover:text-wealth-700 transition-colors cursor-pointer"
    onClick={onClick}
  >
    <i className="fas fa-chart-line" aria-hidden="true" />
  </button>
)

export default ChartIconButton
