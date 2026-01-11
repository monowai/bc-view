import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import { useRouter } from "next/router"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import WizardContainer from "@components/features/independence/WizardContainer"
import { toPercent } from "@lib/independence/conversions"
import { PlanWithExpensesResponse, WizardFormData } from "types/independence"

function EditPlanWizard(): React.ReactElement {
  const router = useRouter()
  const { planId } = router.query

  const { data, error, isLoading } = useSwr<PlanWithExpensesResponse>(
    planId ? `/api/independence/plans/${planId}/details` : null,
    planId ? simpleFetcher(`/api/independence/plans/${planId}/details`) : null,
    {
      // Always fetch fresh data when editing - avoid stale cache issues
      revalidateOnMount: true,
      dedupingInterval: 0,
    },
  )

  if (!planId || isLoading) {
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
    workingIncomeMonthly: plan.workingIncomeMonthly || 0,
    workingExpensesMonthly: plan.workingExpensesMonthly || 0,
    investmentAllocationPercent: toPercent(
      plan.investmentAllocationPercent,
      0.8,
    ),
    pensionMonthly: plan.pensionMonthly || 0,
    socialSecurityMonthly: plan.socialSecurityMonthly || 0,
    otherIncomeMonthly: plan.otherIncomeMonthly || 0,
    expenses: expenses.map((e) => ({
      categoryLabelId: e.categoryLabelId,
      categoryName: e.categoryName,
      monthlyAmount: e.monthlyAmount,
    })),
    targetBalance: plan.targetBalance,
    cashReturnRate: toPercent(plan.cashReturnRate, 0.035),
    equityReturnRate: toPercent(plan.equityReturnRate, 0.07),
    housingReturnRate: toPercent(plan.housingReturnRate, 0.04),
    inflationRate: toPercent(plan.inflationRate, 0.025),
    cashAllocation: toPercent(plan.cashAllocation, 0.2),
    equityAllocation: toPercent(plan.equityAllocation, 0.6),
    housingAllocation: toPercent(plan.housingAllocation, 0.2),
    selectedPortfolioIds: [],
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
