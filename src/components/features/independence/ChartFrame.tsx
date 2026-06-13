import React, { useEffect, useRef } from "react"
import { ResponsiveContainer } from "recharts"

interface ChartFrameProps {
  /** A single Recharts chart element (ComposedChart, BarChart, ...). */
  children: React.ReactElement
  /**
   * Responsive Tailwind height. Defaults to a mobile-first scale so charts
   * don't dominate the vertical layout on narrow viewports.
   */
  heightClass?: string
  className?: string
}

// Mobile-first: shorter on phones so stacked charts don't push everything
// off-screen, taller on larger viewports for detail.
const DEFAULT_HEIGHT = "h-56 sm:h-72 lg:h-80"

/**
 * Shared wrapper for every Independence projection chart.
 *
 * Solves two mobile problems Recharts doesn't handle on its own:
 *  1. Stuck tooltips — touch devices fire no mouseleave, so a tapped tooltip
 *     never clears. We dismiss it when the user taps outside the chart.
 *  2. Fixed heights — a single hard px height squashes charts on phones; the
 *     default responsive height scales with the viewport.
 */
export function ChartFrame({
  children,
  heightClass = DEFAULT_HEIGHT,
  className,
}: ChartFrameProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function dismiss(e: Event): void {
      const root = ref.current
      if (!root) return
      const target = e.target as Node | null
      // Taps inside the chart select a point — leave those alone.
      if (target && root.contains(target)) return
      // Recharts hides the active tooltip via React's onMouseLeave, which React
      // derives from a delegated, bubbling `mouseout` (a raw `mouseleave` won't
      // trigger it). Touch devices never send one, so synthesise it.
      const wrapper = root.querySelector(".recharts-wrapper")
      wrapper?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
    }
    document.addEventListener("touchstart", dismiss, { passive: true })
    return () => document.removeEventListener("touchstart", dismiss)
  }, [])

  return (
    <div
      ref={ref}
      className={`${heightClass}${className ? ` ${className}` : ""}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export default ChartFrame
