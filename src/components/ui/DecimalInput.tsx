import React, { useEffect, useRef, useState } from "react"

/**
 * Numeric input that preserves intermediate text (e.g. "5.") while the user is
 * typing, then commits the parsed number on blur.
 */
function DecimalInput({
  value,
  onChange,
  className,
  ...rest
}: {
  value: number | undefined
  onChange: (value: number) => void
  className?: string
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>): React.ReactElement {
  const [display, setDisplay] = useState(
    value != null && value !== 0 ? String(value) : "",
  )
  const focusedRef = useRef(false)

  // Sync from parent when not focused
  useEffect(() => {
    if (!focusedRef.current) {
      setDisplay(value != null && value !== 0 ? String(value) : "")
    }
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        const val = e.target.value
        if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
          setDisplay(val)
          const num = parseFloat(val)
          if (!isNaN(num)) {
            onChange(num)
          } else if (val === "") {
            onChange(0)
          }
        }
      }}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={(e) => {
        focusedRef.current = false
        const num = parseFloat(e.target.value)
        if (!isNaN(num)) {
          onChange(num)
          setDisplay(String(num))
        } else {
          setDisplay(value != null && value !== 0 ? String(value) : "")
        }
      }}
      className={className}
      {...rest}
    />
  )
}

export default DecimalInput
