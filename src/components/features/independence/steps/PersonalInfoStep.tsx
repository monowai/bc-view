import React, { useState } from "react"
import { Control, Controller, FieldErrors } from "react-hook-form"
import { WizardFormData } from "types/independence"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import IndependenceSettingsModal from "../IndependenceSettingsModal"

interface PersonalInfoStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
}

const currentYear = new Date().getFullYear()

const CURRENCIES = [
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
]

export default function PersonalInfoStep({
  control,
  errors,
}: PersonalInfoStepProps): React.ReactElement {
  const { settings, isLoading: settingsLoading } = useIndependenceSettings()
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const yearOfBirth = settings?.yearOfBirth
  const currentAge = yearOfBirth ? currentYear - yearOfBirth : undefined
  const targetIndependenceAge = settings?.targetIndependenceAge ?? 65
  const lifeExpectancy = settings?.lifeExpectancy ?? 90

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Personal Information
        </h2>
        <p className="text-sm text-gray-600">
          Basic information about you and your independence timeline.
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
                placeholder="e.g., My Independence Plan"
                className={`
                  w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500
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
            Give your plan a descriptive name, or leave blank to use &quot;My
            Independence Plan&quot;.
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
                  w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500
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

        <div>
          <label
            htmlFor="country"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Country
            <span className="ml-1 text-xs font-normal text-gray-500">
              (optional)
            </span>
          </label>
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ""}
                id="country"
                type="text"
                placeholder="e.g., Thailand"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 border-gray-300"
              />
            )}
          />
          <p className="mt-1 text-sm text-gray-500">
            Which country do the values in this plan apply to? For example, you
            might be working in Singapore but planning to retire in Thailand —
            the values here are for Thailand.
          </p>
        </div>

        <div>
          <label
            htmlFor="narrative"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            About this plan
            <span className="ml-1 text-xs font-normal text-gray-500">
              (optional)
            </span>
          </label>
          <Controller
            name="narrative"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                value={field.value ?? ""}
                id="narrative"
                rows={4}
                placeholder="Tell us a bit about this plan — your life situation, assumptions, or anything else we should know. For example: 'I'm working in Singapore until 50, then moving to Thailand for semi-retirement.'"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 border-gray-300"
              />
            )}
          />
          <p className="mt-1 text-sm text-gray-500">
            Free-form notes about this plan. The AI assistant can use this
            context to better interpret your questions.
          </p>
        </div>

        {/* Read-only settings display */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              Your Independence Settings
            </h3>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="text-sm text-independence-600 hover:text-independence-700 font-medium"
            >
              <i className="fas fa-edit mr-1"></i>
              Edit
            </button>
          </div>

          {settingsLoading ? (
            <p className="text-sm text-gray-500">Loading settings...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Year of Birth</p>
                <p className="text-sm font-medium text-gray-900">
                  {yearOfBirth ?? "Not set"}
                </p>
                {currentAge !== undefined && (
                  <p className="text-xs text-gray-500">
                    Currently {currentAge} years old
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Target Independence Age
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {targetIndependenceAge}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Life Expectancy</p>
                <p className="text-sm font-medium text-gray-900">
                  {lifeExpectancy}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-independence-50 border border-independence-200 rounded-lg p-4">
          <div className="flex">
            <i className="fas fa-info-circle text-independence-600 mt-0.5 mr-3"></i>
            <div className="text-sm text-independence-700">
              <p className="font-medium">Planning horizon</p>
              <p className="mt-1">
                Your planning horizon will be{" "}
                {lifeExpectancy - targetIndependenceAge} years (from age{" "}
                {targetIndependenceAge} to {lifeExpectancy}). These settings
                apply across all your independence plans.
              </p>
            </div>
          </div>
        </div>
      </div>

      <IndependenceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  )
}
