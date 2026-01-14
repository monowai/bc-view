import * as yup from "yup"

const currentYear = new Date().getFullYear()

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
  yearOfBirth: yup
    .number()
    .required("Year of birth is required")
    .min(1920, "Must be 1920 or later")
    .max(currentYear - 18, `Must be ${currentYear - 18} or earlier`),
  targetRetirementAge: yup
    .number()
    .required("Target retirement age is required")
    .min(18, "Must be at least 18")
    .max(100, "Must be 100 or less")
    .test(
      "greater-than-current",
      "Retirement age must be after your current age",
      function (value) {
        const { yearOfBirth } = this.parent
        if (!value || !yearOfBirth) return true
        const currentAge = currentYear - yearOfBirth
        return value > currentAge
      },
    ),
  lifeExpectancy: yup
    .number()
    .required("Life expectancy is required")
    .min(50, "Must be at least 50")
    .max(120, "Must be 120 or less")
    .test(
      "greater-than-retirement",
      "Life expectancy must be after retirement age",
      function (value) {
        const { targetRetirementAge } = this.parent
        return !value || !targetRetirementAge || value > targetRetirementAge
      },
    ),
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

export const expensesStepSchema = yup.object({
  expenses: yup.array().of(expenseSchema),
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
  ...preRetirementSchema.fields,
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

export const defaultWizardValues = {
  planName: "",
  yearOfBirth: currentYear - 55, // Default to age 55
  targetRetirementAge: 65,
  lifeExpectancy: 90,
  // Pre-retirement (working years)
  workingIncomeMonthly: 0,
  workingExpensesMonthly: 0,
  investmentAllocationPercent: 80, // 80% of surplus invested
  // Retirement income sources
  pensionMonthly: 0,
  socialSecurityMonthly: 0,
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
  manualAssets: defaultManualAssets,
  lifeEvents: [],
}
