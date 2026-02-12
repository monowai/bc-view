import React from "react"
import { Control, FieldErrors, useWatch } from "react-hook-form"
import { WizardFormData } from "types/independence"
import { StepHeader, CurrencyInputWithPeriod, SummaryBox } from "../form"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"

interface IncomeSourcesStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
}

export default function IncomeSourcesStep({
  control,
  errors,
}: IncomeSourcesStepProps): React.ReactElement {
  const pensionMonthly = useWatch({ control, name: "pensionMonthly" }) || 0
  const socialSecurityMonthly =
    useWatch({ control, name: "socialSecurityMonthly" }) || 0
  const otherIncomeMonthly =
    useWatch({ control, name: "otherIncomeMonthly" }) || 0

  // Fetch rental income from RE assets
  const { configs, isLoading: configsLoading } = usePrivateAssetConfigs()

  // Calculate net rental income (after all expenses) grouped by currency
  const rentalIncomeByCurrency = React.useMemo(() => {
    if (!configs) return {}
    return configs
      .filter((c) => !c.isPrimaryResidence && c.monthlyRentalIncome > 0)
      .reduce(
        (acc, c) => {
          const currency = c.rentalCurrency || "NZD"
          // Management fee: use greater of fixed or percentage
          const percentFee = c.monthlyRentalIncome * c.managementFeePercent
          const effectiveMgmtFee = Math.max(c.monthlyManagementFee, percentFee)
          // Convert annual amounts to monthly
          const monthlyTax = (c.annualPropertyTax || 0) / 12
          const monthlyInsurance = (c.annualInsurance || 0) / 12
          // Total expenses
          const totalExpenses =
            effectiveMgmtFee +
            (c.monthlyBodyCorporateFee || 0) +
            monthlyTax +
            monthlyInsurance +
            (c.monthlyOtherExpenses || 0)
          const netIncome = c.monthlyRentalIncome - totalExpenses
          acc[currency] = (acc[currency] || 0) + netIncome
          return acc
        },
        {} as Record<string, number>,
      )
  }, [configs])

  const hasRentalIncome = Object.keys(rentalIncomeByCurrency).length > 0

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
    <div className="space-y-6">
      <StepHeader
        title="Income Sources after Independence"
        description="Tell us about your expected indepdendnce income sources. These amounts will offset your monthly expenses."
      />

      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start">
        <i className="fas fa-check-circle text-green-600 mt-0.5 mr-2"></i>
        <p className="text-sm text-green-700">
          You can configure income sources later — click Next to continue.
        </p>
      </div>

      {/* Property Rental Income (read-only) */}
      {!configsLoading && hasRentalIncome && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <i className="fas fa-home text-green-600 mr-2"></i>
            <h3 className="text-sm font-semibold text-green-800">
              Property Rental Income
            </h3>
          </div>
          <div className="space-y-1">
            {Object.entries(rentalIncomeByCurrency).map(
              ([currency, amount]) => (
                <div
                  key={currency}
                  className="flex justify-between text-sm text-green-700"
                >
                  <span>Net Monthly Rental ({currency})</span>
                  <span className="font-medium">
                    {amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ),
            )}
          </div>
          <p className="text-xs text-green-600 mt-2">
            <i className="fas fa-info-circle mr-1"></i>
            Net of all expenses. Configure in Accounts &gt; Real Estate.
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
                Pension Income
              </h3>
            </div>
            <p className="text-sm text-blue-700">
              Pension income is calculated from your {pensionAssets.length}{" "}
              configured pension asset
              {pensionAssets.length > 1 ? "s" : ""}.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              Configure in Accounts with &apos;Is Pension&apos; enabled.
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

        <CurrencyInputWithPeriod
          name="socialSecurityMonthly"
          label="Government Benefits (Social Security)"
          helperText="Expected government benefits (e.g., Social Security, state pension)."
          control={control}
          errors={errors}
        />

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
