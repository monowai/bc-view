import React, { useState, useCallback } from "react"
import { Control, Controller, FieldErrors } from "react-hook-form"
import { WizardFormData } from "types/independence"
import MathInput from "@components/ui/MathInput"
import {
  Period,
  convertForDisplay,
  convertForStorage,
} from "@lib/independence/periodConversion"

// Fields that are numeric and can be used with CurrencyInputWithPeriod
type NumericField = Extract<
  keyof WizardFormData,
  | "workingIncomeMonthly"
  | "workingExpensesMonthly"
  | "taxesMonthly"
  | "bonusMonthly"
  | "pensionMonthly"
  | "socialSecurityMonthly"
  | "otherIncomeMonthly"
  | "targetBalance"
>

interface CurrencyInputWithPeriodProps {
  name: NumericField
  label: string
  helperText?: string
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  min?: number
  step?: number
  symbol?: string
  /** Default period for this field (monthly or annual) */
  defaultPeriod?: Period
  /** If true, hide the period toggle (e.g., for one-time amounts like targetBalance) */
  hidePeriodToggle?: boolean
}

export default function CurrencyInputWithPeriod({
  name,
  label,
  helperText,
  control,
  errors,
  min = 0,
  step = 100,
  symbol = "$",
  defaultPeriod = "monthly",
  hidePeriodToggle = false,
}: CurrencyInputWithPeriodProps): React.ReactElement {
  const [period, setPeriod] = useState<Period>(defaultPeriod)
  const error = errors[name]

  const togglePeriod = useCallback(() => {
    setPeriod((prev: Period) => (prev === "monthly" ? "annual" : "monthly"))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
        {!hidePeriodToggle && (
          <button
            type="button"
            onClick={togglePeriod}
            className="px-2 py-0.5 text-xs font-medium rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-independence-500"
            style={{
              backgroundColor: period === "annual" ? "#fef3c7" : "#e0f2fe",
              borderColor: period === "annual" ? "#f59e0b" : "#0ea5e9",
              color: period === "annual" ? "#92400e" : "#0369a1",
            }}
            title={`Currently showing ${period === "annual" ? "annual" : "monthly"} values. Click to toggle.`}
          >
            {period === "annual" ? "Yearly" : "Monthly"}
          </button>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-gray-500 z-10">
          {symbol}
        </span>
        <Controller
          name={name}
          control={control}
          render={({ field }) => {
            // Convert stored monthly value to display value
            const displayValue = convertForDisplay(field.value || 0, period)

            // Handle input change: convert display value back to monthly for storage
            const handleChange = (inputValue: number): void => {
              const monthlyValue = convertForStorage(inputValue, period)
              field.onChange(monthlyValue)
            }

            return (
              <MathInput
                id={name}
                value={displayValue}
                onChange={handleChange}
                min={min}
                step={period === "annual" ? step * 12 : step}
                placeholder="0"
                className={`
                  w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500
                  ${error ? "border-red-500" : "border-gray-300"}
                `}
              />
            )
          }}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message as string}</p>
      )}
      {helperText && (
        <p className="mt-1 text-sm text-gray-500">
          {helperText} • Supports expressions (e.g., 1000*12)
        </p>
      )}
      {!helperText && !hidePeriodToggle && (
        <p className="mt-1 text-xs text-gray-400">
          {period === "annual"
            ? "Stored as monthly (÷12)"
            : "Supports math: 1000+500, 5000*12"}
        </p>
      )}
      {!helperText && hidePeriodToggle && (
        <p className="mt-1 text-xs text-gray-400">
          Supports math: 1000+500, 5000*12
        </p>
      )}
    </div>
  )
}
