import React from "react"
import { Control, Controller, FieldErrors, useWatch } from "react-hook-form"
import { WizardFormData } from "types/retirement"

interface PersonalInfoStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
}

const currentYear = new Date().getFullYear()

const CURRENCIES = [
  { code: "NZD", name: "New Zealand Dollar", symbol: "$" },
  { code: "AUD", name: "Australian Dollar", symbol: "$" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "CAD", name: "Canadian Dollar", symbol: "$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
]

export default function PersonalInfoStep({
  control,
  errors,
}: PersonalInfoStepProps): React.ReactElement {
  const yearOfBirth = useWatch({ control, name: "yearOfBirth" })
  const currentAge = yearOfBirth ? currentYear - yearOfBirth : undefined

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Personal Information
        </h2>
        <p className="text-gray-600">
          Let&apos;s start with some basic information about you and your
          retirement timeline.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="planName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Plan Name
          </label>
          <Controller
            name="planName"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                id="planName"
                type="text"
                placeholder="e.g., My Retirement Plan"
                className={`
                  w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                  ${errors.planName ? "border-red-500" : "border-gray-300"}
                `}
              />
            )}
          />
          {errors.planName && (
            <p className="mt-1 text-sm text-red-600">
              {errors.planName.message}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Give your plan a descriptive name to help you identify it later.
          </p>
        </div>

        <div>
          <label
            htmlFor="expensesCurrency"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Currency
          </label>
          <Controller
            name="expensesCurrency"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                id="expensesCurrency"
                className={`
                  w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                  ${errors.expensesCurrency ? "border-red-500" : "border-gray-300"}
                `}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.expensesCurrency && (
            <p className="mt-1 text-sm text-red-600">
              {errors.expensesCurrency.message}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            All monetary amounts in this plan will be recorded in this currency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="yearOfBirth"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Year of Birth
            </label>
            <Controller
              name="yearOfBirth"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="yearOfBirth"
                  type="number"
                  min={1920}
                  max={currentYear - 18}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.yearOfBirth ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.yearOfBirth && (
              <p className="mt-1 text-sm text-red-600">
                {errors.yearOfBirth.message}
              </p>
            )}
            {currentAge !== undefined && (
              <p className="mt-1 text-sm text-gray-500">
                Currently {currentAge} years old
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="targetRetirementAge"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Retirement Age
            </label>
            <Controller
              name="targetRetirementAge"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="targetRetirementAge"
                  type="number"
                  min={18}
                  max={100}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.targetRetirementAge ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.targetRetirementAge && (
              <p className="mt-1 text-sm text-red-600">
                {errors.targetRetirementAge.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="lifeExpectancy"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Life Expectancy
            </label>
            <Controller
              name="lifeExpectancy"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="lifeExpectancy"
                  type="number"
                  min={50}
                  max={120}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.lifeExpectancy ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.lifeExpectancy && (
              <p className="mt-1 text-sm text-red-600">
                {errors.lifeExpectancy.message}
              </p>
            )}
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex">
            <i className="fas fa-info-circle text-orange-600 mt-0.5 mr-3"></i>
            <div className="text-sm text-orange-800">
              <p className="font-medium">Planning horizon</p>
              <p className="mt-1">
                Your planning horizon will be calculated as the years from
                retirement to life expectancy. A longer horizon means your
                savings need to last longer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
