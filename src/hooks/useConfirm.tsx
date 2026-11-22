import React, { useCallback, useRef, useState } from "react"
import ConfirmDialog from "@components/ui/ConfirmDialog"

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "red" | "amber" | "blue"
}

/**
 * Promise-based replacement for `window.confirm`, rendered with the app's
 * ConfirmDialog so it is styled, labelled and keyboard-trapped like every
 * other modal.
 *
 *   const [confirm, confirmDialog] = useConfirm()
 *   if (!(await confirm({ title, message }))) return
 *   ...
 *   return <>{...}{confirmDialog}</>
 */
export function useConfirm(): [
  (options: ConfirmOptions) => Promise<boolean>,
  React.ReactElement | null,
] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmOptions): Promise<boolean> => {
    resolver.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (ok: boolean): void => {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }

  const dialog = options ? (
    <ConfirmDialog
      title={options.title}
      message={options.message}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      variant={options.variant}
      zClass="z-[60]"
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null

  return [confirm, dialog]
}
