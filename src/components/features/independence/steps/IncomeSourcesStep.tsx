import React from "react"
import { Control, Controller, FieldErrors, useWatch } from "react-hook-form"
import { WizardFormData } from "types/independence"
import { StepHeader, CurrencyInputWithPeriod, SummaryBox } from "../form"
import MathInput from "@components/ui/MathInput"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import { currentAgeFromSettings } from "@lib/independence/age"

/**
 * Future value of an ordinary annuity:
 *   FV = startingBalance × (1+r)^n + PMT × ((1+r)^n − 1) / r
 * matches PensionIncomeService.calculatePolicyFutureValue (interest before
 * contribution per month), so the inline lump-sum estimate here agrees with
 * the projection-detail modal and the projection itself.
 */
function projectLumpSum(
  startingBalance: number,
  monthlyContribution: number,
  annualReturnRate: number,
  yearsToMaturity: number,
): number {
  if (yearsToMaturity <= 0) return startingBalance
  const r = annualReturnRate / 12
  const n = yearsToMaturity * 12
  const growth = Math.pow(1 + r, n)
  const startFv = startingBalance * growth
  const pmtFv =
    r > 0 ? monthlyContribution * ((growth - 1) / r) : monthlyContribution * n
  return startFv + pmtFv
}

interface IncomeSourcesStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  isEditMode?: boolean
}

export default function IncomeSourcesStep({
  control,
  errors,
  isEditMode,
}: IncomeSourcesStepProps): React.ReactElement {
  const pensionMonthly = useWatch({ control, name: "pensionMonthly" }) || 0
  const socialSecurityMonthly =
    useWatch({ control, name: "socialSecurityMonthly" }) || 0
  const otherIncomeMonthly =
    useWatch({ control, name: "otherIncomeMonthly" }) || 0

  const { configs } = usePrivateAssetConfigs()
  // yearOfBirth lives in user-level UserIndependenceSettings (svc-retire),
  // not the plan. useIndependenceSettings returns the unwrapped entity —
  // an earlier inline SWR fetch tried to unwrap a `.data` envelope that
  // doesn't exist and silently kept currentAge null.
  const { settings: independenceSettings } = useIndependenceSettings()
  const currentAge = currentAgeFromSettings(independenceSettings) ?? null

  // Filter pension assets (isPension = true), excluding composites
  const pensionAssets = React.useMemo(() => {
    if (!configs) return []
    return configs.filter(
      (c) => c.isPension && !(c.subAccounts && c.subAccounts.length > 0),
    )
  }, [configs])

  // Composite policy assets (CPF, ILP, etc.) with payout configured
  const compositeAssets = React.useMemo(() => {
    if (!configs) return []
    return configs.filter(
      (c) => c.subAccounts && c.subAccounts.length > 0 && c.payoutAge,
    )
  }, [configs])

  const totalMonthlyIncome =
    pensionMonthly + socialSecurityMonthly + otherIncomeMonthly

  return (
    <div className="space-y-4">
      <StepHeader
        title="Income Sources after Independence"
        description="Tell us about your expected independence income sources. These amounts will offset your monthly expenses."
      />

      {(!isEditMode ||
        (pensionMonthly === 0 &&
          socialSecurityMonthly === 0 &&
          otherIncomeMonthly === 0)) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start">
          <i className="fas fa-check-circle text-green-600 mt-0.5 mr-2"></i>
          <p className="text-sm text-green-700">
            You can configure income sources later — click Next to continue.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Only show manual pension input when no pension assets are configured */}
        {pensionAssets.length === 0 ? (
          <CurrencyInputWithPeriod
            name="pensionMonthly"
            label="Pension"
            helperText="Expected pension from employer or private schemes."
            control={control}
            errors={errors}
          />
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <i className="fas fa-piggy-bank text-blue-600 mr-2"></i>
              <h3 className="text-sm font-semibold text-blue-800">
                Income from private Retirement plans
              </h3>
            </div>
            <ul className="space-y-1 mt-2">
              {pensionAssets.map((c) => {
                const payoutAge = c.payoutAge
                const yearsToMaturity =
                  payoutAge && currentAge ? payoutAge - currentAge : null
                const startingBalance =
                  (c.subAccounts?.reduce(
                    (sum, sa) => sum + (sa.balance || 0),
                    0,
                  ) || 0) > 0
                    ? (c.subAccounts?.reduce(
                        (sum, sa) => sum + (sa.balance || 0),
                        0,
                      ) ?? 0)
                    : 0
                // contributionFrequency=ANNUAL stores the raw annual figure
                // in monthlyContribution (legacy column name). Divide by 12
                // here so the inline FV matches the projection backend,
                // which annualises the same way.
                const monthlyForProjection =
                  c.contributionFrequency === "ANNUAL"
                    ? (c.monthlyContribution || 0) / 12
                    : c.monthlyContribution || 0
                const projectedLumpSum =
                  c.lumpSum && yearsToMaturity && yearsToMaturity > 0
                    ? projectLumpSum(
                        startingBalance,
                        monthlyForProjection,
                        c.expectedReturnRate || 0,
                        yearsToMaturity,
                      )
                    : null
                return (
                  <li
                    key={c.assetId}
                    className="flex justify-between text-sm text-blue-700"
                  >
                    <span>
                      {c.assetId}
                      {payoutAge ? ` — payout at age ${payoutAge}` : ""}
                    </span>
                    <span className="font-medium">
                      {c.monthlyPayoutAmount && c.monthlyPayoutAmount > 0
                        ? `$${Math.round(c.monthlyPayoutAmount).toLocaleString()}/mo annuity`
                        : projectedLumpSum != null
                          ? `~$${Math.round(projectedLumpSum).toLocaleString()} lump sum`
                          : c.lumpSum
                            ? "Lump sum (set age to project)"
                            : "Configured"}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-blue-600 mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              Read-only — figures come from your asset config + Profile age.
              Edit in Accounts to change.
            </p>
          </div>
        )}

        {/* Composite policy assets with payout info */}
        {compositeAssets.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <i className="fas fa-layer-group text-indigo-600 mr-2"></i>
              <h3 className="text-sm font-semibold text-indigo-800">
                Policy Assets
              </h3>
            </div>
            <div className="space-y-2">
              {compositeAssets.map((c) => {
                const total = c.subAccounts
                  ? c.subAccounts.reduce(
                      (sum, sa) => sum + (sa.balance || 0),
                      0,
                    )
                  : 0
                return (
                  <div
                    key={c.assetId}
                    className="flex justify-between text-sm text-indigo-700"
                  >
                    <span>
                      {c.policyType || "Composite"} — payout at age{" "}
                      {c.payoutAge}
                      {c.lockedUntilDate &&
                        ` (locked until ${c.lockedUntilDate})`}
                    </span>
                    <span className="font-medium">
                      {c.monthlyPayoutAmount
                        ? `$${Math.round(c.monthlyPayoutAmount).toLocaleString()}/mo`
                        : c.lumpSum
                          ? `$${total.toLocaleString()} lump sum`
                          : "Configured"}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-indigo-600 mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              Policy payouts are included in retirement projections.
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <div className="flex-1">
            <CurrencyInputWithPeriod
              name="socialSecurityMonthly"
              label="Government Benefits (Social Security)"
              helperText="Expected government benefits (e.g., Social Security, state pension)."
              control={control}
              errors={errors}
            />
          </div>
          <div className="w-32">
            <Controller
              name="benefitsStartAge"
              control={control}
              render={({ field }) => (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Starting Age
                  </label>
                  <MathInput
                    value={field.value ?? 0}
                    onChange={(v) =>
                      field.onChange(v ? Math.round(v) : undefined)
                    }
                    placeholder="e.g. 65"
                    min={50}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Age benefits begin
                  </p>
                </div>
              )}
            />
          </div>
        </div>

        <CurrencyInputWithPeriod
          name="otherIncomeMonthly"
          label="Other Income"
          helperText="Part-time work, annuities, or other sources (excl. property above)."
          control={control}
          errors={errors}
        />
      </div>

      <SummaryBox
        items={[
          {
            icon: "fa-wallet",
            label: "Total Monthly Income",
            value: totalMonthlyIncome,
            format: "currency",
          },
        ]}
        color="green"
        description="This income will be subtracted from your monthly expenses to calculate your net withdrawal needs."
      />
    </div>
  )
}
