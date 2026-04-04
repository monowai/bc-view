import * as yup from "yup"

export const personalInfoSchema = yup.object({
  planName: yup
    .string()
    .required("Plan name is required")
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name must be 50 characters or less"),
  expensesCurrency: yup
    .string()
    .required("Currency is required")
    .default("NZD"),
})

export const preRetirementSchema = yup.object({
  workingIncomeMonthly: yup
    .number()
    .min(0, "Must be positive")
    .required("Working income is required")
    .default(0),
  workingExpensesMonthly: yup
    .number()
    .min(0, "Must be positive")
    .required("Working expenses are required")
    .default(0),
  taxesMonthly: yup.number().min(0, "Must be positive").default(0),
  bonusMonthly: yup.number().min(0, "Must be positive").default(0),
  investmentAllocationPercent: yup
    .number()
    .min(0, "Must be 0% or higher")
    .max(100, "Must be 100% or less")
    .required("Investment allocation is required")
    .default(80),
})

export const incomeSourcesSchema = yup.object({
  pensionMonthly: yup.number().min(0, "Must be positive").default(0),
  socialSecurityMonthly: yup.number().min(0, "Must be positive").default(0),
  otherIncomeMonthly: yup.number().min(0, "Must be positive").default(0),
})

export const expenseSchema = yup.object({
  categoryLabelId: yup.string().required("Category is required"),
  categoryName: yup.string().required(),
  monthlyAmount: yup
    .number()
    .required("Amount is required")
    .min(0, "Must be positive"),
})

export const workingExpensesStepSchema = yup.object({
  workingExpenses: yup.array().of(expenseSchema),
})

export const expensesStepSchema = yup.object({
  expenses: yup.array().of(expenseSchema),
})

export const contributionSchema = yup.object({
  assetId: yup.string().required("Asset is required"),
  assetName: yup.string().required(),
  monthlyAmount: yup
    .number()
    .required("Amount is required")
    .min(0, "Must be positive"),
  contributionType: yup
    .string()
    .oneOf(["PENSION", "INSURANCE"])
    .required("Type is required"),
})

export const contributionsStepSchema = yup.object({
  contributions: yup.array().of(contributionSchema),
})

// Schema for manual asset entry (when no portfolios)
export const manualAssetsSchema = yup.object({
  CASH: yup.number().min(0, "Must be positive").default(0),
  EQUITY: yup.number().min(0, "Must be positive").default(0),
  ETF: yup.number().min(0, "Must be positive").default(0),
  MUTUAL_FUND: yup.number().min(0, "Must be positive").default(0),
  RE: yup.number().min(0, "Must be positive").default(0),
})

export const goalsSchema = yup.object({
  targetBalance: yup.number().min(0, "Must be positive").nullable(),
  cashReturnRate: yup
    .number()
    .min(0, "Must be 0% or higher")
    .max(20, "Must be 20% or less")
    .default(3),
  equityReturnRate: yup
    .number()
    .min(0, "Must be 0% or higher")
    .max(30, "Must be 30% or less")
    .default(8),
  housingReturnRate: yup
    .number()
    .min(0, "Must be 0% or higher")
    .max(20, "Must be 20% or less")
    .default(4),
  inflationRate: yup
    .number()
    .min(0, "Must be 0% or higher")
    .max(10, "Must be 10% or less")
    .default(2.5),
  cashAllocation: yup
    .number()
    .min(0, "Must be 0% or higher")
    .max(100, "Must be 100% or less")
    .default(20),
  equityAllocation: yup
    .number()
    .min(0, "Must be 0% or higher")
    .max(100, "Must be 100% or less")
    .default(80),
  housingAllocation: yup
    .number()
    .min(0, "Must be 0% or higher")
    .max(100, "Must be 100% or less")
    .default(0),
  selectedPortfolioIds: yup.array().of(yup.string()),
  manualAssets: manualAssetsSchema,
})

export const wizardSchema = yup.object({
  ...personalInfoSchema.fields,
  ...workingExpensesStepSchema.fields,
  ...preRetirementSchema.fields,
  ...contributionsStepSchema.fields,
  ...incomeSourcesSchema.fields,
  ...expensesStepSchema.fields,
  ...goalsSchema.fields,
})

export const defaultManualAssets = {
  CASH: 0,
  EQUITY: 0,
  ETF: 0,
  MUTUAL_FUND: 0,
  RE: 0,
}

const currentYear = new Date().getFullYear()

export const defaultWizardValues = {
  planName: "",
  yearOfBirth: currentYear - 55, // Default to age 55 (kept for form type compatibility)
  targetRetirementAge: 65, // Kept for form type compatibility
  lifeExpectancy: 90, // Kept for form type compatibility
  // Working expenses (categorized)
  workingExpenses: [],
  // Pre-retirement (working years)
  workingIncomeMonthly: 0,
  workingExpensesMonthly: 0, // Computed from workingExpenses sum
  taxesMonthly: 0,
  bonusMonthly: 0,
  investmentAllocationPercent: 80, // 80% of surplus invested
  // Retirement income sources
  pensionMonthly: 0,
  socialSecurityMonthly: 0,
  benefitsStartAge: undefined,
  otherIncomeMonthly: 0,
  expenses: [],
  expensesCurrency: "NZD",
  targetBalance: undefined,
  cashReturnRate: 3,
  equityReturnRate: 8,
  housingReturnRate: 4,
  inflationRate: 2.5,
  cashAllocation: 20,
  equityAllocation: 80,
  housingAllocation: 0,
  selectedPortfolioIds: [],
  excludedRentalAssetIds: [],
  manualAssets: defaultManualAssets,
  lifeEvents: [],
  contributions: [],
}
