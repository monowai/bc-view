import React, { useState, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import { useRouter } from "next/router"
import { mutate } from "swr"
import WizardProgress from "./WizardProgress"
import WizardNavigation from "./WizardNavigation"
import PersonalInfoStep from "./steps/PersonalInfoStep"
import WorkingExpensesStep from "./steps/WorkingExpensesStep"
import AssetsStep from "./steps/AssetsStep"
import AssumptionsStep from "./steps/AssumptionsStep"
import ContributionsStep from "./steps/ContributionsStep"
import IncomeSourcesStep from "./steps/IncomeSourcesStep"
import LifeEventsStep from "./steps/LifeEventsStep"
import ExpensesStep from "./steps/ExpensesStep"
import { wizardSchema, defaultWizardValues } from "@lib/independence/schema"
import {
  TOTAL_STEPS,
  getStepFields,
  WIZARD_STEPS,
} from "@lib/independence/stepConfig"
import { toDecimal } from "@lib/independence/conversions"
import { WizardFormData, PlanRequest } from "types/independence"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

interface WizardContainerProps {
  planId?: string
  initialData?: Partial<WizardFormData>
}

export default function WizardContainer({
  planId,
  initialData,
}: WizardContainerProps): React.ReactElement {
  const isEditMode = Boolean(planId)
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set())
  const { preferences } = useUserPreferences()

  // Use user's preferred currency for new plans
  const effectiveDefaults = useMemo(() => {
    if (isEditMode && initialData) {
      // Edit mode: use plan's saved currency
      return { ...defaultWizardValues, ...initialData }
    }
    // New plan: use user's preferred reporting currency
    const userCurrency = preferences?.reportingCurrencyCode || "USD"
    return { ...defaultWizardValues, expensesCurrency: userCurrency }
  }, [isEditMode, initialData, preferences?.reportingCurrencyCode])

  const {
    control,
    trigger,
    setValue,
    formState: { errors },
    getValues,
  } = useForm<WizardFormData>({
    resolver: yupResolver(wizardSchema) as any,
    defaultValues: effectiveDefaults,
    mode: "onBlur",
  })

  // Validate all steps and return which ones have errors
  const validateAllSteps = useCallback(async (): Promise<Set<number>> => {
    const errorSteps = new Set<number>()

    for (const step of WIZARD_STEPS) {
      const fields = getStepFields(step.id)
      const isValid = await trigger(fields)
      if (!isValid) {
        errorSteps.add(step.id)
      }
    }

    setStepErrors(errorSteps)
    return errorSteps
  }, [trigger])

  // Validate a single step
  const validateStep = useCallback(
    async (stepNumber: number): Promise<boolean> => {
      const fields = getStepFields(stepNumber)
      const isValid = await trigger(fields)

      setStepErrors((prev) => {
        const next = new Set(prev)
        if (isValid) {
          next.delete(stepNumber)
        } else {
          next.add(stepNumber)
        }
        return next
      })

      return isValid
    },
    [trigger],
  )

  const handleNext = async (): Promise<void> => {
    const isValid = await validateStep(currentStep)

    if (isValid) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep((prev) => prev + 1)
      } else {
        await handleSubmitPlan()
      }
    }
  }

  const handleBack = (): void => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleStepClick = (step: number): void => {
    // In edit mode, allow navigating to any step directly
    if (isEditMode && step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step)
    }
  }

  const handleCancel = (): void => {
    if (isEditMode && planId) {
      router.push(`/independence/plans/${planId}`)
    } else {
      router.push("/independence")
    }
  }

  const handleSave = async (): Promise<void> => {
    // Validate all steps before saving
    const errorSteps = await validateAllSteps()

    if (errorSteps.size > 0) {
      // Navigate to the first step with errors
      const firstErrorStep = Math.min(...Array.from(errorSteps))
      setCurrentStep(firstErrorStep)
      setError(
        `Please fix validation errors on step${errorSteps.size > 1 ? "s" : ""} ${Array.from(errorSteps).join(", ")} before saving.`,
      )
      return
    }

    await handleSubmitPlan()
  }

  const handleSubmitPlan = async (): Promise<void> => {
    setIsSubmitting(true)
    setError(null)

    try {
      const formData = getValues()

      // Calculate planning horizon
      const planningHorizonYears =
        formData.lifeExpectancy - formData.targetRetirementAge

      // Calculate total monthly expenses
      const monthlyExpenses = formData.expenses.reduce(
        (sum, expense) => sum + expense.monthlyAmount,
        0,
      )

      // Filter out zero-value manual assets before sending
      const nonZeroManualAssets = formData.manualAssets
        ? Object.fromEntries(
            Object.entries(formData.manualAssets).filter(
              ([, value]) => value > 0,
            ),
          )
        : null
      const manualAssets =
        nonZeroManualAssets && Object.keys(nonZeroManualAssets).length > 0
          ? nonZeroManualAssets
          : null

      // Backend stores decimals (0.07 for 7%), so convert from percentage
      const planRequest: PlanRequest = {
        name: formData.planName,
        planningHorizonYears,
        lifeExpectancy: formData.lifeExpectancy,
        yearOfBirth: formData.yearOfBirth,
        monthlyExpenses,
        expensesCurrency: formData.expensesCurrency,
        targetBalance: formData.targetBalance ?? null,
        cashReturnRate: toDecimal(formData.cashReturnRate),
        equityReturnRate: toDecimal(formData.equityReturnRate),
        housingReturnRate: toDecimal(formData.housingReturnRate),
        inflationRate: toDecimal(formData.inflationRate),
        cashAllocation: toDecimal(formData.cashAllocation),
        equityAllocation: toDecimal(formData.equityAllocation),
        housingAllocation: toDecimal(formData.housingAllocation),
        pensionMonthly: formData.pensionMonthly,
        socialSecurityMonthly: formData.socialSecurityMonthly,
        otherIncomeMonthly: formData.otherIncomeMonthly,
        workingIncomeMonthly: formData.workingIncomeMonthly,
        workingExpensesMonthly: formData.workingExpensesMonthly,
        taxesMonthly: formData.taxesMonthly,
        bonusMonthly: formData.bonusMonthly,
        investmentAllocationPercent: toDecimal(
          formData.investmentAllocationPercent,
        ),
        lifeEvents:
          formData.lifeEvents?.length > 0
            ? JSON.stringify(formData.lifeEvents)
            : undefined,
        manualAssets,
      }

      const url = isEditMode
        ? `/api/independence/plans/${planId}`
        : "/api/independence/plans"
      const method = isEditMode ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(planRequest),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(
          errorData.message ||
            `Failed to ${isEditMode ? "update" : "create"} plan`,
        )
        setIsSubmitting(false)
        return
      }

      const result = await response.json()
      const savedPlanId = result.data.id

      // Sync expenses - for edit mode, delete existing expenses first
      if (isEditMode) {
        // Fetch existing expenses and delete them
        const existingExpensesRes = await fetch(
          `/api/independence/plans/${savedPlanId}/expenses`,
        )
        if (existingExpensesRes.ok) {
          const existingData = await existingExpensesRes.json()
          const existingExpenses = existingData.data || []
          for (const expense of existingExpenses) {
            await fetch(
              `/api/independence/plans/${savedPlanId}/expenses/${expense.id}`,
              {
                method: "DELETE",
              },
            )
          }
        }
      }

      // Add working expenses with expensePhase: "WORKING"
      if (formData.workingExpenses?.length > 0) {
        for (const expense of formData.workingExpenses) {
          if (expense.monthlyAmount > 0) {
            await fetch(`/api/independence/plans/${savedPlanId}/expenses`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                categoryLabelId: expense.categoryLabelId,
                categoryName: expense.categoryName,
                monthlyAmount: expense.monthlyAmount,
                currency: formData.expensesCurrency,
                expensePhase: "WORKING",
              }),
            })
          }
        }
      }

      // Add retirement expenses with expensePhase: "RETIREMENT" (default)
      if (formData.expenses.length > 0) {
        for (const expense of formData.expenses) {
          await fetch(`/api/independence/plans/${savedPlanId}/expenses`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              categoryLabelId: expense.categoryLabelId,
              categoryName: expense.categoryName,
              monthlyAmount: expense.monthlyAmount,
              currency: formData.expensesCurrency,
              expensePhase: "RETIREMENT",
            }),
          })
        }
      }

      // Sync contributions - for edit mode, delete existing contributions first
      if (isEditMode) {
        const existingContributionsRes = await fetch(
          `/api/independence/plans/${savedPlanId}/contributions`,
        )
        if (existingContributionsRes.ok) {
          const existingData = await existingContributionsRes.json()
          const existingContributions = existingData.data || []
          for (const contribution of existingContributions) {
            await fetch(
              `/api/independence/plans/${savedPlanId}/contributions/${contribution.id}`,
              {
                method: "DELETE",
              },
            )
          }
        }
      }

      // Add contributions (only those with amounts > 0)
      if (formData.contributions?.length > 0) {
        for (const contribution of formData.contributions) {
          if (contribution.monthlyAmount > 0) {
            await fetch(
              `/api/independence/plans/${savedPlanId}/contributions`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  assetId: contribution.assetId,
                  assetName: contribution.assetName,
                  monthlyAmount: contribution.monthlyAmount,
                  currency: formData.expensesCurrency,
                  contributionType: contribution.contributionType,
                }),
              },
            )
          }
        }
      }

      // Invalidate all plan cache keys so subsequent fetches get fresh data
      await mutate(`/api/independence/plans/${savedPlanId}`)
      await mutate(`/api/independence/plans/${savedPlanId}/details`)

      // Navigate to the plan view
      router.push(`/independence/plans/${savedPlanId}`)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred while saving the plan"
      setError(message)
      setIsSubmitting(false)
    }
  }

  const renderStep = (): React.ReactElement | null => {
    switch (currentStep) {
      case 1:
        return <PersonalInfoStep control={control} errors={errors} />
      case 2:
        return (
          <WorkingExpensesStep
            control={control}
            errors={errors}
            setValue={setValue}
          />
        )
      case 3:
        return <ContributionsStep control={control} errors={errors} />
      case 4:
        return <AssetsStep control={control} setValue={setValue} />
      case 5:
        return (
          <AssumptionsStep
            control={control}
            errors={errors}
            setValue={setValue}
          />
        )
      case 6:
        return <IncomeSourcesStep control={control} errors={errors} />
      case 7:
        return (
          <ExpensesStep control={control} errors={errors} setValue={setValue} />
        )
      case 8:
        return <LifeEventsStep control={control} />
      default:
        return null
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <WizardProgress
          currentStep={currentStep}
          isEditMode={isEditMode}
          stepErrors={stepErrors}
          onStepClick={handleStepClick}
        />

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()}>
          {renderStep()}

          <WizardNavigation
            currentStep={currentStep}
            onBack={handleBack}
            onNext={handleNext}
            onCancel={handleCancel}
            onSave={handleSave}
            isSubmitting={isSubmitting}
            isLastStep={currentStep === TOTAL_STEPS}
            isEditMode={isEditMode}
          />
        </form>
      </div>
    </div>
  )
}
