import React from "react"

interface SpinnerProps {
  label?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses: Record<string, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
}

export default function Spinner({
  label,
  size = "sm",
  className = "",
}: SpinnerProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center ${sizeClasses[size]} ${className}`}
    >
      <i className={`fas fa-spinner fa-spin${label ? " mr-2" : ""}`}></i>
      {label}
    </span>
  )
}
