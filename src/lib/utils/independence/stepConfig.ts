import { WizardFormData } from "types/independence"
import { wizardMessages } from "./messages"

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
    name: wizardMessages.steps.personalInfo.name,
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
    name: wizardMessages.steps.employment.name,
    fields: [
      "workingIncomeMonthly",
      "workingExpensesMonthly",
      "investmentAllocationPercent",
    ],
  },
  {
    id: 3,
    name: wizardMessages.steps.assets.name,
    fields: ["selectedPortfolioIds", "manualAssets"],
  },
  {
    id: 4,
    name: wizardMessages.steps.assumptions.name,
    fields: [
      "targetBalance",
      "cashReturnRate",
      "equityReturnRate",
      "housingReturnRate",
      "inflationRate",
      "cashAllocation",
      "equityAllocation",
      "housingAllocation",
    ],
  },
  {
    id: 5,
    name: wizardMessages.steps.income.name,
    fields: ["pensionMonthly", "socialSecurityMonthly", "otherIncomeMonthly"],
  },
  {
    id: 6,
    name: wizardMessages.steps.expenses.name,
    fields: ["expenses"],
  },
  {
    id: 7,
    name: wizardMessages.steps.lifeEvents.name,
    fields: ["lifeEvents"],
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
