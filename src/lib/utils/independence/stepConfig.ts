import { WizardFormData } from "types/independence"
import { wizardMessages } from "./messages"

/**
 * Centralized wizard step configuration.
 * Single source of truth for step order, names, and field mappings.
 */

export interface WizardStep {
  id: number
  name: string
  /**
   * Font Awesome icon class (without the leading `fas`) used by
   * WizardProgress so the step indicator stays recognisable on narrow
   * mobile widths where the digit-and-label combination collapsed to an
   * unhelpful "1, 2, 3...".
   */
  icon: string
  fields: (keyof WizardFormData)[]
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    name: wizardMessages.steps.personalInfo.name,
    icon: "fa-user",
    fields: ["planName", "expensesCurrency", "country", "narrative"],
  },
  {
    id: 2,
    name: wizardMessages.steps.assets.name,
    icon: "fa-piggy-bank",
    fields: ["selectedPortfolioIds", "manualAssets"],
  },
  {
    id: 3,
    name: wizardMessages.steps.assumptions.name,
    icon: "fa-sliders-h",
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
    id: 4,
    name: wizardMessages.steps.income.name,
    icon: "fa-hand-holding-usd",
    fields: ["pensionMonthly", "socialSecurityMonthly", "otherIncomeMonthly"],
  },
  {
    id: 5,
    name: wizardMessages.steps.expenses.name,
    icon: "fa-receipt",
    fields: ["expenses"],
  },
  {
    id: 6,
    name: wizardMessages.steps.lifeEvents.name,
    icon: "fa-calendar-day",
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
