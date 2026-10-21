import React, { useCallback, forwardRef } from "react"
import { localIsoDate, todayIso } from "@lib/formatters"

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  min?: string
  max?: string
  autoFocus?: boolean
}

/**
 * Date input with keyboard shortcuts for quick date adjustment.
 *
 * Shortcuts:
 * - `t` or `T`: Set to today's date
 * - `-` or `+`/`=`: Adjust day (-1 / +1)
 * - Shift + `-` or `+`: Adjust month (-1 / +1)
 * - Ctrl/Cmd + `-` or `+`: Adjust year (-1 / +1)
 * - Arrow keys: Native browser behavior (adjusts focused segment)
 */
const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  function DateInput(
    { value, onChange, className = "", disabled, min, max, autoFocus },
    ref,
  ) {
    const adjustDate = useCallback(
      (unit: "day" | "month" | "year", amount: number): void => {
        // Local midnight of the shown date (a bare YYYY-MM-DD parses as UTC),
        // or now; local setters and formatting keep it on the same calendar.
        const currentDate = value ? new Date(`${value}T00:00:00`) : new Date()

        if (unit === "day") {
          currentDate.setDate(currentDate.getDate() + amount)
        } else if (unit === "month") {
          currentDate.setMonth(currentDate.getMonth() + amount)
        } else if (unit === "year") {
          currentDate.setFullYear(currentDate.getFullYear() + amount)
        }

        onChange(localIsoDate(currentDate))
      },
      [value, onChange],
    )

    const setToday = useCallback((): void => {
      const today = todayIso()
      onChange(today)
    }, [onChange])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      // "T" sets date to today
      if (e.key === "t" || e.key === "T") {
        e.preventDefault()
        setToday()
        return
      }

      const isMinus = e.key === "-"
      const isPlus = e.key === "+" || e.key === "="

      if (!isMinus && !isPlus) {
        return // Let arrow keys use native browser behavior
      }

      e.preventDefault()
      const amount = isMinus ? -1 : 1

      if (e.ctrlKey || e.metaKey) {
        adjustDate("year", amount)
      } else if (e.shiftKey) {
        adjustDate("month", amount)
      } else {
        adjustDate("day", amount)
      }
    }

    return (
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={className}
        disabled={disabled}
        min={min}
        max={max}
        autoFocus={autoFocus}
      />
    )
  },
)

export default DateInput
