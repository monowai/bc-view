import React from "react"
import { Control, Controller, FieldErrors } from "react-hook-form"
import { WizardFormData } from "types/independence"
import { INPUT_CLS, INPUT_CLS_BASE } from "@lib/ui/formClasses"

interface PersonalInfoStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
}

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
                className={`${INPUT_CLS_BASE} ${errors.planName ? "border-red-500" : "border-gray-300"}`}
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
                className={`${INPUT_CLS_BASE} ${errors.expensesCurrency ? "border-red-500" : "border-gray-300"}`}
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
                placeholder="e.g. Philippines"
                className={INPUT_CLS}
              />
            )}
          />
          <p className="mt-1 text-sm text-gray-500">
            Which country do the values in this plan apply to? For example, you
            might be earning in one country but planning to retire to another.
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
                className={INPUT_CLS}
              />
            )}
          />
          <p className="mt-1 text-sm text-gray-500">
            Free-form notes about this plan. The AI assistant can use this
            context to better interpret your questions.
          </p>
        </div>

        <div>
          <label
            htmlFor="primaryStrategy"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Primary Strategy
            <span className="ml-1 text-xs font-normal text-gray-500">
              (optional)
            </span>
          </label>
          <Controller
            name="primaryStrategy"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={field.value ?? ""}
                id="primaryStrategy"
                className={INPUT_CLS}
              >
                <option value="">Auto-detect from plan</option>
                <option value="FIRE">FIRE — live off liquid investments</option>
                <option value="PENSION">
                  Pension — rely on guaranteed income
                </option>
                <option value="HYBRID">
                  Hybrid — bridge liquid until pensions start
                </option>
              </select>
            )}
          />
          <p className="mt-1 text-sm text-gray-500">
            Pins which section of the Retirement Strategies panel is
            highlighted. Auto-detect picks the one that best matches your plan
            inputs.
          </p>
        </div>

        <div>
          <label
            htmlFor="headlineMetric"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Headline Metric
            <span className="ml-1 text-xs font-normal text-gray-500">
              (optional)
            </span>
          </label>
          <Controller
            name="headlineMetric"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={field.value ?? ""}
                id="headlineMetric"
                className={INPUT_CLS}
              >
                <option value="">Default (match strategy)</option>
                <option value="EARLY_RETIREMENT_PROGRESS">
                  Early Retirement Progress
                </option>
                <option value="RETIREMENT_AGE_FI">
                  Retirement-Age Progress
                </option>
                <option value="INCOME_COVERAGE">Income Coverage</option>
                <option value="BRIDGE_PROGRESS">Bridge Progress</option>
              </select>
            )}
          />
          <p className="mt-1 text-sm text-gray-500">
            Picks the metric featured in the projection header and on the Wealth
            management tab.
          </p>
        </div>
      </div>
    </div>
  )
}
