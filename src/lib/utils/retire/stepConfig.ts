import { WizardFormData } from "types/retirement"

/**
 * Centralized wizard step configuration.
 * Single source of truth for step order, names, and field mappings.
 */

export interface WizardStep {
  id: number
  name: string
  fields: (keyof WizardFormData)[]
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    name: "Personal Info",
    fields: [
      "planName",
      "yearOfBirth",
      "targetRetirementAge",
      "lifeExpectancy",
      "expensesCurrency",
    ],
  },
  {
    id: 2,
    name: "Pre-Retirement",
    fields: [
      "workingIncomeMonthly",
      "workingExpensesMonthly",
      "investmentAllocationPercent",
    ],
  },
  {
    id: 3,
    name: "Goals",
    fields: [
      "targetBalance",
      "cashReturnRate",
      "equityReturnRate",
      "housingReturnRate",
      "inflationRate",
      "cashAllocation",
      "equityAllocation",
      "housingAllocation",
      "selectedPortfolioIds",
    ],
  },
  {
    id: 4,
    name: "Income",
    fields: ["pensionMonthly", "socialSecurityMonthly", "otherIncomeMonthly"],
  },
  {
    id: 5,
    name: "Expenses",
    fields: ["expenses"],
  },
]

export const TOTAL_STEPS = WIZARD_STEPS.length

/**
 * Get fields for a specific step (1-indexed).
 */
export const getStepFields = (stepNumber: number): (keyof WizardFormData)[] => {
  const step = WIZARD_STEPS.find((s) => s.id === stepNumber)
  return step?.fields ?? []
}
