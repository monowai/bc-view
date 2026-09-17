import React, { useEffect, useId, useRef, useState } from "react"

export interface ActionMenuItem {
  label: string
  icon?: string
  onSelect: () => void
  /** Renders in the loss hue and sits below a divider. */
  destructive?: boolean
  disabled?: boolean
  title?: string
}

/**
 * A single overflow control for secondary actions.
 *
 * Exists because this product kept laying out every action it had as a row of
 * equally-weighted buttons — the Independence page opened with eight of them
 * above the fold, none more important than another, before a single number.
 * One primary action stays on the page; everything else comes here.
 */
export default function ActionMenu({
  items,
  label = "More actions",
  align = "right",
  triggerClassName,
}: {
  items: ActionMenuItem[]
  label?: string
  align?: "left" | "right"
  triggerClassName?: string
}): React.ReactElement | null {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e: MouseEvent | TouchEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const visible = items.filter((i) => i !== undefined)
  if (visible.length === 0) return null

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-independence-500 motion-reduce:transition-none dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        }
      >
        <i aria-hidden="true" className="fas fa-ellipsis" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute z-30 mt-1 min-w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-[0_2px_10px_rgb(0,0,0,0.1)] dark:border-gray-700 dark:bg-gray-900 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {visible.map((item, idx) => {
            const dividerAbove =
              item.destructive && !visible[idx - 1]?.destructive && idx > 0
            return (
              <React.Fragment key={item.label}>
                {dividerAbove && (
                  <div
                    role="separator"
                    className="my-1 border-t border-gray-100 dark:border-gray-800"
                  />
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  title={item.title}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors duration-150 disabled:opacity-50 motion-reduce:transition-none ${
                    item.destructive
                      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {item.icon && (
                    <i
                      aria-hidden="true"
                      className={`fas ${item.icon} w-4 text-center text-xs`}
                    />
                  )}
                  {item.label}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
