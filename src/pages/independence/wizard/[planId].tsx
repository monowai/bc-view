import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import { useRouter } from "next/router"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import WizardContainer from "@components/features/independence/WizardContainer"
import { toPercent } from "@lib/independence/conversions"
import {
  PlanWithExpensesResponse,
  WizardFormData,
  ManualAssets,
  LifeEvent,
  PlanContributionsResponse,
  ContributionFormEntry,
} from "types/independence"

interface WorkingExpensesResponse {
  data: Array<{
    categoryLabelId: string
    categoryName: string
    monthlyAmount: number
  }>
}

function EditPlanWizard(): React.ReactElement {
  const router = useRouter()
  const { planId } = router.query

  // Fetch plan with retirement expenses
  const { data, error, isLoading } = useSwr<PlanWithExpensesResponse>(
    planId ? `/api/independence/plans/${planId}/details` : null,
    planId ? simpleFetcher(`/api/independence/plans/${planId}/details`) : null,
    {
      // Always fetch fresh data when editing - avoid stale cache issues
      revalidateOnMount: true,
      dedupingInterval: 0,
    },
  )

  // Fetch working expenses separately
  const { data: workingExpensesData, isLoading: workingExpensesLoading } =
    useSwr<WorkingExpensesResponse>(
      planId
        ? `/api/independence/plans/${planId}/expenses?phase=WORKING`
        : null,
      planId
        ? simpleFetcher(
            `/api/independence/plans/${planId}/expenses?phase=WORKING`,
          )
        : null,
      {
        revalidateOnMount: true,
        dedupingInterval: 0,
      },
    )

  // Fetch contributions separately
  const { data: contributionsData, isLoading: contributionsLoading } =
    useSwr<PlanContributionsResponse>(
      planId ? `/api/independence/plans/${planId}/contributions` : null,
      planId
        ? simpleFetcher(`/api/independence/plans/${planId}/contributions`)
        : null,
      {
        revalidateOnMount: true,
        dedupingInterval: 0,
      },
    )

  // Wait for all data to load before rendering the wizard
  const allDataLoading =
    isLoading || workingExpensesLoading || contributionsLoading

  if (!planId || allDataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center py-12">
            <i className="fas fa-spinner fa-spin text-3xl text-orange-600"></i>
            <p className="mt-4 text-gray-500">Loading plan...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <i className="fas fa-exclamation-circle mr-2"></i>
            Failed to load plan. Please try again.
          </div>
        </div>
      </div>
    )
  }

  // Transform backend data to form format
  const plan = data.plan
  const expenses = data.expenses || []
  const workingExpenses = workingExpensesData?.data || []
  const contributions = contributionsData?.data || []

  // Parse manualAssets from JSON string if needed
  const parseManualAssets = (): ManualAssets => {
    const defaultAssets: ManualAssets = {
      CASH: 0,
      EQUITY: 0,
      ETF: 0,
      MUTUAL_FUND: 0,
      RE: 0,
    }
    if (!plan.manualAssets) return defaultAssets
    // If it's already an object, use it; otherwise parse JSON string
    if (typeof plan.manualAssets === "object") {
      return { ...defaultAssets, ...plan.manualAssets }
    }
    try {
      const parsed = JSON.parse(plan.manualAssets as unknown as string)
      return { ...defaultAssets, ...parsed }
    } catch {
      return defaultAssets
    }
  }

  // Parse lifeEvents from JSON string if needed
  const parseLifeEvents = (): LifeEvent[] => {
    if (!plan.lifeEvents) return []
    // If it's already an array, use it; otherwise parse JSON string
    if (Array.isArray(plan.lifeEvents)) {
      return plan.lifeEvents
    }
    try {
      return JSON.parse(plan.lifeEvents)
    } catch {
      return []
    }
  }

  // Calculate values from stored plan data
  const currentYear = new Date().getFullYear()
  const lifeExpectancy = plan.lifeExpectancy || 90
  const targetRetirementAge = lifeExpectancy - plan.planningHorizonYears
  // Use stored yearOfBirth if available, otherwise estimate from targetRetirementAge
  const yearOfBirth =
    plan.yearOfBirth || currentYear - (targetRetirementAge - 10)

  const initialData: Partial<WizardFormData> = {
    planName: plan.name,
    yearOfBirth,
    targetRetirementAge,
    lifeExpectancy,
    expensesCurrency: plan.expensesCurrency || "NZD",
    // Working expenses (categorized)
    workingExpenses: workingExpenses.map((e) => ({
      categoryLabelId: e.categoryLabelId,
      categoryName: e.categoryName,
      monthlyAmount: e.monthlyAmount,
    })),
    workingIncomeMonthly: plan.workingIncomeMonthly || 0,
    workingExpensesMonthly: plan.workingExpensesMonthly || 0,
    taxesMonthly: plan.taxesMonthly || 0,
    bonusMonthly: plan.bonusMonthly || 0,
    investmentAllocationPercent: toPercent(
      plan.investmentAllocationPercent,
      0.8,
    ),
    pensionMonthly: plan.pensionMonthly || 0,
    socialSecurityMonthly: plan.socialSecurityMonthly || 0,
    otherIncomeMonthly: plan.otherIncomeMonthly || 0,
    // Retirement expenses
    expenses: expenses.map((e) => ({
      categoryLabelId: e.categoryLabelId,
      categoryName: e.categoryName,
      monthlyAmount: e.monthlyAmount,
    })),
    targetBalance: plan.targetBalance,
    cashReturnRate: toPercent(plan.cashReturnRate, 0.03),
    equityReturnRate: toPercent(plan.equityReturnRate, 0.08),
    housingReturnRate: toPercent(plan.housingReturnRate, 0.04),
    inflationRate: toPercent(plan.inflationRate, 0.025),
    cashAllocation: toPercent(plan.cashAllocation, 0.2),
    equityAllocation: toPercent(plan.equityAllocation, 0.8),
    housingAllocation: toPercent(plan.housingAllocation, 0.0),
    selectedPortfolioIds: [],
    manualAssets: parseManualAssets(),
    lifeEvents: parseLifeEvents(),
    // Contributions (pension/insurance)
    contributions: contributions.map(
      (c): ContributionFormEntry => ({
        assetId: c.assetId,
        assetName: c.assetName || c.assetId,
        monthlyAmount: c.monthlyAmount,
        contributionType: c.contributionType,
      }),
    ),
  }

  return (
    <>
      <Head>
        <title>Edit Plan | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Edit Independence Plan
            </h1>
            <p className="text-gray-600 mt-2">
              Update your independence plan details.
            </p>
          </div>

          <WizardContainer
            key={`${planId}-${plan.updatedDate}`}
            planId={planId as string}
            initialData={initialData}
          />
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(EditPlanWizard)
