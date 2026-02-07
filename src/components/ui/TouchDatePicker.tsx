import React, { useState, useCallback, useMemo, useEffect, useRef } from "react"

/**
 * Touch-friendly date picker optimized for tablets.
 * Uses large touch targets and drum-scroll style selection.
 */

interface TouchDatePickerProps {
  value: string // ISO date string YYYY-MM-DD
  onChange: (value: string) => void
  minYear?: number
  maxYear?: number
  label?: string
  hint?: string
  className?: string
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export default function TouchDatePicker({
  value,
  onChange,
  minYear = new Date().getFullYear(),
  maxYear = new Date().getFullYear() + 30,
  label,
  hint,
  className = "",
}: TouchDatePickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse current value or use sensible default
  const parsed = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number)
      if (y && m && d) return { year: y, month: m - 1, day: d }
    }
    // Default to 5 years from now if no value
    const future = new Date()
    future.setFullYear(future.getFullYear() + 5)
    return { year: future.getFullYear(), month: future.getMonth(), day: 1 }
  }, [value])

  const [selectedYear, setSelectedYear] = useState(parsed.year)
  const [selectedMonth, setSelectedMonth] = useState(parsed.month)
  const [selectedDay, setSelectedDay] = useState(parsed.day)

  // Update local state when value prop changes
  useEffect(() => {
    setSelectedYear(parsed.year)
    setSelectedMonth(parsed.month)
    setSelectedDay(parsed.day)
  }, [parsed])

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate()
  }, [selectedYear, selectedMonth])

  // Clamp day if month changes
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth)
    }
  }, [daysInMonth, selectedDay])

  // Generate year options
  const years = useMemo(() => {
    const arr = []
    for (let y = minYear; y <= maxYear; y++) arr.push(y)
    return arr
  }, [minYear, maxYear])

  // Format display value
  const displayValue = useMemo(() => {
    if (!value) return "Select date..."
    return `${selectedDay} ${FULL_MONTHS[selectedMonth]} ${selectedYear}`
  }, [value, selectedDay, selectedMonth, selectedYear])

  const handleConfirm = useCallback(() => {
    const mm = String(selectedMonth + 1).padStart(2, "0")
    const dd = String(selectedDay).padStart(2, "0")
    onChange(`${selectedYear}-${mm}-${dd}`)
    setIsOpen(false)
  }, [selectedYear, selectedMonth, selectedDay, onChange])

  const handleClear = useCallback(() => {
    onChange("")
    setIsOpen(false)
  }, [onChange])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return undefined
    const handleClick = (e: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {displayValue}
        </span>
        <i
          className={`fas fa-calendar-alt text-gray-400 transition-transform ${isOpen ? "text-indigo-500" : ""}`}
        ></i>
      </button>

      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}

      {/* Picker Modal */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3">
            <div className="text-white/70 text-xs uppercase tracking-wider">
              Locked Until
            </div>
            <div className="text-white text-xl font-semibold">
              {selectedDay} {FULL_MONTHS[selectedMonth]} {selectedYear}
            </div>
          </div>

          {/* Year Quick Select */}
          <div className="px-3 py-3 border-b border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 px-1">
              Year
            </div>
            <div className="flex flex-wrap gap-1.5">
              {years.slice(0, 12).map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    year === selectedYear
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  }`}
                >
                  {year}
                </button>
              ))}
              {years.length > 12 && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-2 py-2 rounded-lg text-sm bg-gray-100 text-gray-700 border-0 focus:ring-2 focus:ring-indigo-500"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Month Grid */}
          <div className="px-3 py-3 border-b border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 px-1">
              Month
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS.map((month, idx) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => setSelectedMonth(idx)}
                  className={`py-3 rounded-lg text-sm font-medium transition-all ${
                    idx === selectedMonth
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>

          {/* Day Grid */}
          <div className="px-3 py-3 border-b border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 px-1">
              Day
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                      day === selectedDay
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                    }`}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-3 py-3 bg-gray-50">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Clear
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
