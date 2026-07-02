import React, { useState } from "react"

interface FlipCardProps {
  /** Content rendered on the front face (shown first). */
  front: React.ReactNode
  /** Content rendered on the back face. */
  back: React.ReactNode
  /** Short label used in the toggle button on the front face ("→ {backLabel}"). */
  frontLabel: string
  /** Short label used in the toggle button on the back face ("← {frontLabel}"). */
  backLabel: string
}

/**
 * Mobile-only flip card. Renders `front` and `back` as two faces of a 3-D
 * card; a toggle button on each face rotates between them.
 *
 * Only active below the `lg` breakpoint. On `lg+` callers should use the
 * normal two-column layout (`hidden lg:flex`) in parallel with `lg:hidden`
 * wrapping this component.
 *
 * Accessibility:
 * - The non-visible face carries `aria-hidden="true"` and `inert` so its
 *   focusable children cannot be tabbed into.
 * - Toggle buttons carry a descriptive `aria-label`.
 * - `motion-reduce:transition-none` respects the OS reduced-motion setting.
 */
export default function FlipCard({
  front,
  back,
  frontLabel,
  backLabel,
}: FlipCardProps): React.ReactElement {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="[perspective:1200px]"
      // Give the container a stable height equal to whichever face is taller.
      // Both faces share the same grid cell so the container height is the max.
      style={{ minHeight: 0 }}
    >
      {/* Inner wrapper — both faces share grid-area 1/1 so the container
          height is the natural max of the two faces. */}
      <div
        className={[
          "grid w-full transition-transform duration-500 motion-reduce:transition-none",
          "[transform-style:preserve-3d]",
          flipped ? "[transform:rotateY(180deg)]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ gridTemplateAreas: "'card'" }}
        data-testid="flip-card-inner"
      >
        {/* ── Front face ── */}
        <div
          className="[grid-area:card] min-w-0 max-w-full [backface-visibility:hidden]"
          aria-hidden={flipped ? "true" : undefined}
          {...(flipped ? { inert: true } : {})}
        >
          {front}
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={() => setFlipped(true)}
              aria-label={`Show ${backLabel}`}
              className="inline-flex items-center gap-1 text-xs text-independence-600 hover:text-independence-800 focus:outline-none focus:ring-2 focus:ring-independence-500 rounded px-2 py-1"
            >
              {backLabel}
              <i className="fas fa-rotate-right" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Back face ── */}
        <div
          className="[grid-area:card] min-w-0 max-w-full [backface-visibility:hidden] [transform:rotateY(180deg)]"
          aria-hidden={!flipped ? "true" : undefined}
          {...(!flipped ? { inert: true } : {})}
        >
          <div className="flex justify-start mb-2">
            <button
              type="button"
              onClick={() => setFlipped(false)}
              aria-label={`Show ${frontLabel}`}
              className="inline-flex items-center gap-1 text-xs text-independence-600 hover:text-independence-800 focus:outline-none focus:ring-2 focus:ring-independence-500 rounded px-2 py-1"
            >
              <i className="fas fa-rotate-left" aria-hidden="true" />
              {frontLabel}
            </button>
          </div>
          {back}
        </div>
      </div>
    </div>
  )
}
