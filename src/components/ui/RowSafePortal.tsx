import React from "react"
import { createPortal } from "react-dom"

/**
 * Render a dialog opened from inside a table row or card into the body.
 * React events still bubble through portals to the row, whose click and
 * double-click have their own meaning, so they stop at this boundary.
 */
export default function RowSafePortal({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
