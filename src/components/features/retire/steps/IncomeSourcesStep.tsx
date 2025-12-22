import React from "react"
import { Control, FieldErrors, useWatch } from "react-hook-form"
import { WizardFormData } from "types/retirement"
import { StepHeader, CurrencyInput, SummaryBox } from "../form"

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

  const totalMonthlyIncome =
    pensionMonthly + socialSecurityMonthly + otherIncomeMonthly

  return (
    <div className="space-y-6">
      <StepHeader
        title="Income Sources"
        description="Tell us about your expected retirement income. These amounts will offset your monthly expenses."
      />

      <div className="space-y-4">
        <CurrencyInput
          name="pensionMonthly"
          label="Monthly Pension"
          helperText="Expected monthly pension from employer or private schemes."
          control={control}
          errors={errors}
        />

        <CurrencyInput
          name="socialSecurityMonthly"
          label="Government Benefits (Social Security)"
          helperText="Expected monthly government retirement benefits."
          control={control}
          errors={errors}
        />

        <CurrencyInput
          name="otherIncomeMonthly"
          label="Other Monthly Income"
          helperText="Rental income, part-time work, annuities, or other sources."
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
