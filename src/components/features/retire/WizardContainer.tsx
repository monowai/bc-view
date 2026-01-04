import React, { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import { useRouter } from "next/router"
import WizardProgress from "./WizardProgress"
import WizardNavigation from "./WizardNavigation"
import PersonalInfoStep from "./steps/PersonalInfoStep"
import EmploymentStep from "./steps/EmploymentStep"
import IncomeSourcesStep from "./steps/IncomeSourcesStep"
import LifeEventsStep from "./steps/LifeEventsStep"
import ExpensesStep from "./steps/ExpensesStep"
import GoalsAssumptionsStep from "./steps/GoalsAssumptionsStep"
import { wizardSchema, defaultWizardValues } from "@lib/retire/schema"
import {
  TOTAL_STEPS,
  getStepFields,
  WIZARD_STEPS,
} from "@lib/retire/stepConfig"
import { toDecimal } from "@lib/retire/conversions"
import { WizardFormData, PlanRequest } from "types/retirement"

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

  const {
    control,
    trigger,
    setValue,
    formState: { errors },
    getValues,
  } = useForm<WizardFormData>({
    resolver: yupResolver(wizardSchema) as any,
    defaultValues: initialData
      ? { ...defaultWizardValues, ...initialData }
      : defaultWizardValues,
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
      router.push(`/retire/plans/${planId}`)
    } else {
      router.push("/retire")
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
        investmentAllocationPercent: toDecimal(
          formData.investmentAllocationPercent,
        ),
        lifeEvents:
          formData.lifeEvents?.length > 0
            ? JSON.stringify(formData.lifeEvents)
            : undefined,
      }

      const url = isEditMode
        ? `/api/retire/plans/${planId}`
        : "/api/retire/plans"
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
          `/api/retire/plans/${savedPlanId}/expenses`,
        )
        if (existingExpensesRes.ok) {
          const existingData = await existingExpensesRes.json()
          const existingExpenses = existingData.data || []
          for (const expense of existingExpenses) {
            await fetch(
              `/api/retire/plans/${savedPlanId}/expenses/${expense.id}`,
              {
                method: "DELETE",
              },
            )
          }
        }
      }

      // Add all expenses (both new and edit modes)
      if (formData.expenses.length > 0) {
        for (const expense of formData.expenses) {
          await fetch(`/api/retire/plans/${savedPlanId}/expenses`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              categoryLabelId: expense.categoryLabelId,
              categoryName: expense.categoryName,
              monthlyAmount: expense.monthlyAmount,
              currency: formData.expensesCurrency,
            }),
          })
        }
      }

      // Navigate to the plan view
      router.push(`/retire/plans/${savedPlanId}`)
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
          <GoalsAssumptionsStep
            control={control}
            errors={errors}
            setValue={setValue}
          />
        )
      case 3:
        return <LifeEventsStep control={control} />
      case 4:
        return <IncomeSourcesStep control={control} errors={errors} />
      case 5:
        return <EmploymentStep control={control} errors={errors} />
      case 6:
        return (
          <ExpensesStep control={control} errors={errors} setValue={setValue} />
        )
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
