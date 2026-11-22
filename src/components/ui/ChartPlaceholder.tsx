import React from "react"
import Spinner from "@components/ui/Spinner"

interface ChartPlaceholderProps {
  /** Tailwind height classes matching the chart it stands in for. */
  heightClass?: string
}

/**
 * Stand-in while a lazily loaded chart's code downloads. It takes the chart's
 * height so the page does not jump when the chart arrives.
 */
export default function ChartPlaceholder({
  heightClass = "h-72",
}: ChartPlaceholderProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      className={`flex items-center justify-center text-gray-400 ${heightClass}`}
    >
      <Spinner size="lg" />
    </div>
  )
}

/**
 * Stand-in for a lazily loaded chart modal: a dimmed overlay with a spinner,
 * shown for the moment between the click and the modal's code arriving.
 */
export function ChartModalPlaceholder(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 text-white"
    >
      <Spinner size="2xl" />
    </div>
  )
}
