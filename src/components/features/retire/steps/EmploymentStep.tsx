import React from "react"
import { Control, FieldErrors, useWatch } from "react-hook-form"
import { WizardFormData } from "types/retirement"
import {
  StepHeader,
  CurrencyInput,
  PercentInput,
  SummaryBox,
  SummaryItem,
} from "../form"

interface EmploymentStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
}

export default function EmploymentStep({
  control,
  errors,
}: EmploymentStepProps): React.ReactElement {
  const workingIncomeMonthly =
    useWatch({ control, name: "workingIncomeMonthly" }) || 0
  const workingExpensesMonthly =
    useWatch({ control, name: "workingExpensesMonthly" }) || 0
  const investmentAllocationPercent =
    useWatch({ control, name: "investmentAllocationPercent" }) || 80

  const monthlySurplus = workingIncomeMonthly - workingExpensesMonthly
  const monthlyInvestment = Math.max(
    0,
    monthlySurplus * (investmentAllocationPercent / 100),
  )

  const summaryItems: SummaryItem[] = [
    {
      icon: "fa-piggy-bank",
      label: "Monthly Surplus",
      value: monthlySurplus,
      format: "currency",
      valueClassName: monthlySurplus >= 0 ? "text-blue-700" : "text-red-600",
    },
    {
      icon: "fa-chart-line",
      label: "Monthly Investment",
      value: monthlyInvestment,
      format: "currency",
    },
  ]

  const description =
    monthlySurplus < 0
      ? "Your expenses exceed your income. Consider adjusting your budget."
      : `You're investing ${investmentAllocationPercent}% of your $${monthlySurplus.toLocaleString()} surplus each month.`

  return (
    <div className="space-y-6">
      <StepHeader
        title="Employment Finances"
        description="Enter your current after-tax income and expenses while working. This helps calculate your projected savings until retirement."
      />

      <div className="space-y-4">
        <CurrencyInput
          name="workingIncomeMonthly"
          label="Monthly Income"
          helperText="Take-home pay after taxes and deductions."
          control={control}
          errors={errors}
        />

        <CurrencyInput
          name="workingExpensesMonthly"
          label="Monthly Expenses"
          helperText="Your total monthly living expenses while working."
          control={control}
          errors={errors}
        />

        <PercentInput
          name="investmentAllocationPercent"
          label="Investment Allocation"
          helperText="Percentage of your monthly surplus to invest for retirement."
          control={control}
          errors={errors}
          step={5}
        />
      </div>

      <SummaryBox items={summaryItems} color="blue" description={description} />
    </div>
  )
}
