import React from "react"
import { Control, FieldErrors, useWatch } from "react-hook-form"
import { WizardFormData } from "types/independence"
import {
  StepHeader,
  CurrencyInputWithPeriod,
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
  const taxesMonthly = useWatch({ control, name: "taxesMonthly" }) || 0
  const bonusMonthly = useWatch({ control, name: "bonusMonthly" }) || 0
  const investmentAllocationPercent =
    useWatch({ control, name: "investmentAllocationPercent" }) || 80

  // Net income = salary + bonus - taxes
  const netIncomeMonthly = workingIncomeMonthly + bonusMonthly - taxesMonthly
  const monthlySurplus = netIncomeMonthly - workingExpensesMonthly
  const monthlyInvestment = Math.max(
    0,
    monthlySurplus * (investmentAllocationPercent / 100),
  )

  const summaryItems: SummaryItem[] = [
    {
      icon: "fa-money-bill-wave",
      label: "Net Income",
      value: netIncomeMonthly,
      format: "currency",
      valueClassName: "text-green-700",
    },
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
      ? "Your expenses exceed your net income. Consider adjusting your budget."
      : `You're investing ${investmentAllocationPercent}% of your $${monthlySurplus.toLocaleString()} surplus each month.`

  return (
    <div className="space-y-6">
      <StepHeader
        title="Employment Finances"
        description="Enter your current after-tax income and expenses while working. This helps calculate your projected savings until independence."
      />

      <div className="space-y-4">
        <CurrencyInputWithPeriod
          name="workingIncomeMonthly"
          label="Gross Salary"
          helperText="Your salary before taxes (not including bonus)."
          control={control}
          errors={errors}
        />

        <CurrencyInputWithPeriod
          name="bonusMonthly"
          label="Bonus"
          helperText="Annual bonus, commissions, or other variable income."
          control={control}
          errors={errors}
          defaultPeriod="annual"
        />

        <CurrencyInputWithPeriod
          name="taxesMonthly"
          label="Taxes"
          helperText="Income tax, social contributions, and other deductions."
          control={control}
          errors={errors}
        />

        <CurrencyInputWithPeriod
          name="workingExpensesMonthly"
          label="Living Expenses"
          helperText="Your total monthly living expenses while working."
          control={control}
          errors={errors}
        />

        <PercentInput
          name="investmentAllocationPercent"
          label="Investment Allocation"
          helperText="Percentage of your monthly surplus to invest for independence."
          control={control}
          errors={errors}
          step={5}
        />
      </div>

      <SummaryBox items={summaryItems} color="blue" description={description} />
    </div>
  )
}
