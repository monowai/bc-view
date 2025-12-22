import React from "react"
import { Control, Controller, FieldErrors } from "react-hook-form"
import { WizardFormData } from "types/retirement"

// Fields that are numeric and can be used with CurrencyInput
type NumericField = Extract<
  keyof WizardFormData,
  | "workingIncomeMonthly"
  | "workingExpensesMonthly"
  | "pensionMonthly"
  | "socialSecurityMonthly"
  | "otherIncomeMonthly"
  | "targetBalance"
>

interface CurrencyInputProps {
  name: NumericField
  label: string
  helperText?: string
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  min?: number
  step?: number
  symbol?: string
}

export default function CurrencyInput({
  name,
  label,
  helperText,
  control,
  errors,
  min = 0,
  step = 100,
  symbol = "$",
}: CurrencyInputProps): React.ReactElement {
  const error = errors[name]

  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-gray-500">{symbol}</span>
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <input
              {...field}
              id={name}
              type="number"
              min={min}
              step={step}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className={`
                w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                ${error ? "border-red-500" : "border-gray-300"}
              `}
            />
          )}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message as string}</p>
      )}
      {helperText && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
    </div>
  )
}
