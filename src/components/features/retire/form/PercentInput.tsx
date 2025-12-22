import React from "react"
import { Control, Controller, FieldErrors } from "react-hook-form"
import { WizardFormData } from "types/retirement"

// Fields that are percentages and can be used with PercentInput
type PercentField = Extract<
  keyof WizardFormData,
  | "investmentAllocationPercent"
  | "cashReturnRate"
  | "equityReturnRate"
  | "housingReturnRate"
  | "inflationRate"
  | "cashAllocation"
  | "equityAllocation"
  | "housingAllocation"
>

interface PercentInputProps {
  name: PercentField
  label: string
  helperText?: string
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  min?: number
  max?: number
  step?: number
}

export default function PercentInput({
  name,
  label,
  helperText,
  control,
  errors,
  min = 0,
  max = 100,
  step = 1,
}: PercentInputProps): React.ReactElement {
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
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <input
              {...field}
              id={name}
              type="number"
              min={min}
              max={max}
              step={step}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className={`
                w-full pr-8 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                ${error ? "border-red-500" : "border-gray-300"}
              `}
            />
          )}
        />
        <span className="absolute right-3 top-2.5 text-gray-500">%</span>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message as string}</p>
      )}
      {helperText && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
    </div>
  )
}
