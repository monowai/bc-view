import React from "react"

interface DialogProps {
  title: string | React.ReactNode
  onClose: () => void
  children: React.ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl"
  scrollable?: boolean
  footer?: React.ReactNode
}

const maxWidthClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
}

export default function Dialog({
  title,
  onClose,
  children,
  maxWidth = "md",
  scrollable = false,
  footer,
}: DialogProps): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className={`bg-white rounded-lg shadow-lg w-full ${maxWidthClasses[maxWidth]} mx-4 z-50 ${scrollable ? "max-h-[90vh] overflow-hidden flex flex-col" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b p-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div
          className={`p-4 space-y-4 ${scrollable ? "overflow-y-auto flex-1" : ""}`}
        >
          {children}
        </div>

        {footer && (
          <div className="flex justify-end space-x-2 p-4 border-t">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

interface CancelButtonProps {
  onClick: () => void
  label?: string
}

Dialog.CancelButton = function CancelButton({
  onClick,
  label = "Cancel",
}: CancelButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

interface SubmitButtonProps {
  onClick: () => void
  label: string
  loadingLabel?: string
  isSubmitting?: boolean
  disabled?: boolean
  variant?: "green" | "red" | "amber" | "blue" | "purple"
}

const variantClasses: Record<string, { active: string; disabled: string }> = {
  green: {
    active: "bg-green-500 hover:bg-green-600",
    disabled: "bg-gray-400 cursor-not-allowed",
  },
  red: {
    active: "bg-red-500 hover:bg-red-600",
    disabled: "bg-gray-400 cursor-not-allowed",
  },
  amber: {
    active: "bg-amber-600 hover:bg-amber-700",
    disabled: "bg-gray-400 cursor-not-allowed",
  },
  blue: {
    active: "bg-blue-500 hover:bg-blue-600",
    disabled: "bg-gray-400 cursor-not-allowed",
  },
  purple: {
    active: "bg-purple-500 hover:bg-purple-600",
    disabled: "bg-gray-400 cursor-not-allowed",
  },
}

Dialog.SubmitButton = function SubmitButton({
  onClick,
  label,
  loadingLabel,
  isSubmitting = false,
  disabled = false,
  variant = "green",
}: SubmitButtonProps): React.ReactElement {
  const isDisabled = disabled || isSubmitting
  const classes = variantClasses[variant]
  return (
    <button
      type="button"
      className={`px-4 py-2 rounded transition-colors text-white ${
        isDisabled ? classes.disabled : classes.active
      }`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {isSubmitting ? (
        <span className="flex items-center">
          <i className="fas fa-spinner fa-spin mr-2"></i>
          {loadingLabel || label}
        </span>
      ) : (
        label
      )}
    </button>
  )
}

interface ErrorAlertProps {
  message: string | null
}

Dialog.ErrorAlert = function ErrorAlert({
  message,
}: ErrorAlertProps): React.ReactElement | null {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
      {message}
    </div>
  )
}

interface SuccessAlertProps {
  message: string | null
}

Dialog.SuccessAlert = function SuccessAlert({
  message,
}: SuccessAlertProps): React.ReactElement | null {
  if (!message) return null
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
      {message}
    </div>
  )
}
