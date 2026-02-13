import React from "react"

type AlertVariant = "error" | "warning" | "info" | "success"

interface AlertProps {
  variant?: AlertVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<AlertVariant, string> = {
  error: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
  info: "bg-blue-50 border-blue-200 text-blue-700",
  success: "bg-green-50 border-green-200 text-green-700",
}

export default function Alert({
  variant = "error",
  children,
  className = "",
}: AlertProps): React.ReactElement {
  return (
    <div
      className={`border rounded-lg p-3 text-sm ${variantStyles[variant]} ${className}`}
    >
      {children}
    </div>
  )
}
