import React, { useState, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import { useRouter } from "next/router"
import useSwr, { mutate } from "swr"
import WizardProgress from "./WizardProgress"
import WizardNavigation from "./WizardNavigation"
import WorkScenarioBanner from "./WorkScenarioBanner"
import IndependenceSettingsSummary from "./IndependenceSettingsSummary"
import PersonalInfoStep from "./steps/PersonalInfoStep"
import AssumptionsStep from "./steps/AssumptionsStep"
import IncomeSourcesStep from "./steps/IncomeSourcesStep"
import LifeEventsStep from "./steps/LifeEventsStep"
import ExpensesStep from "./steps/ExpensesStep"
import Alert from "@components/ui/Alert"
import ClientSelector from "@components/features/shares/ClientSelector"
import { wizardSchema, defaultWizardValues } from "@lib/independence/schema"
import {
  TOTAL_STEPS,
  getStepFields,
  WIZARD_STEPS,
} from "@lib/independence/stepConfig"
import { toDecimal } from "@lib/independence/conversions"
import {
  parseExcludedPortfolioIds,
  serializeAssetDisposals,
  serializeLifeEvents,
  toPlanRequestPayload,
} from "@lib/independence/planHelpers"
import { WizardFormData, RetirementPlan } from "types/independence"
import { Portfolio } from "types/beancounter"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import {
  ACTIVE_PLAN_QUERY_PARAM,
  useIndependencePlans,
} from "@hooks/useIndependencePlans"
import { generatePhasedPlans } from "@lib/onboarding/generatePhasedPlans"

interface WizardContainerProps {
  planId?: string
  initialData?: Partial<WizardFormData>
  /**
   * Full backend plan record, edit mode only. svc-retire's PATCH
   * /plans/{id} consumes a full PlanRequest — see {@link buildWizardPlanRequest}.
   */
  plan?: RetirementPlan | null
  /**
   * Step to open on, 1-indexed. Lets a caller deep-link straight to the part
   * of the plan it was talking about (the Summary tab's spend board links to
   * Expenses). Edit mode only — a new plan has to start at step 1, since the
   * later steps validate against fields step 1 collects. Out-of-range values
   * fall back to 1.
   */
  initialStep?: number
}

/**
 * Builds the PlanRequest body the wizard submits on Save.
 *
 * In edit mode, svc-retire's PATCH /plans/{id} replaces every field it
 * receives and defaults the ones it doesn't. The wizard never surfaces
 * feeRate, investmentTaxRate, investmentAllocationPercent or the
 * working-phase fields (workingIncomeMonthly/workingExpensesMonthly/
 * taxesMonthly/bonusMonthly — managed via work scenarios) as overrides, so
 * omitting them from the body silently reset them to backend defaults (0 /
 * 0.80) on every wizard save. Spread the full-plan echo first (edit mode
 * only — there's no stored plan yet on create), then layer the wizard's
 * own fields on top.
 */
export function buildWizardPlanRequest(
  formData: WizardFormData,
  ctx: {
    isEditMode: boolean
    plan?: RetirementPlan | null
    planningHorizonYears: number
    clientId?: string
    /**
     * Journey this stage is being added to, from `?plan=` — "Add a stage" is
     * pressed from inside one. Create only, like clientId: re-homing an
     * existing stage is a different decision and belongs to the timeline
     * editor, not a wizard save.
     */
    independencePlanId?: string
  },
): Record<string, unknown> {
  const monthlyExpenses = formData.expenses.reduce(
    (sum, expense) => sum + expense.monthlyAmount,
    0,
  )

  return {
    ...(ctx.isEditMode && ctx.plan ? toPlanRequestPayload(ctx.plan) : {}),
    name: formData.planName,
    planningHorizonYears: ctx.planningHorizonYears,
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
    benefitsStartAge: formData.benefitsStartAge,
    otherIncomeMonthly: formData.otherIncomeMonthly,
    // Always send the JSON-serialised array (incl. "[]") so the
    // backend distinguishes "list cleared" from "field omitted".
    lifeEvents: serializeLifeEvents(formData.lifeEvents),
    assetDisposals: serializeAssetDisposals(formData.assetDisposals),
    // `manualAssets` and `excludedPortfolioIds` are deliberately absent. The
    // wizard no longer edits either — wealth belongs to the journey — and both
    // were being sent as an empty default on every save, which on PATCH *wipes*
    // the stored legacy value rather than leaving it alone. Omitted means
    // "unchanged" (PlanService.updatePlan), which is the honest answer now that
    // nothing here can change them. Edit mode still echoes the stored
    // excludedPortfolioIds via toPlanRequestPayload.
    excludedRentalAssetIds: formData.excludedRentalAssetIds || [],
    country: formData.country?.trim() || undefined,
    narrative: formData.narrative?.trim() || undefined,
    primaryStrategy: formData.primaryStrategy || undefined,
    headlineMetric: formData.headlineMetric || undefined,
    ...(!ctx.isEditMode && { clientId: ctx.clientId?.trim() || undefined }),
    ...(!ctx.isEditMode && {
      independencePlanId: ctx.independencePlanId?.trim() || undefined,
    }),
  }
}

export default function WizardContainer({
  planId,
  initialData,
  plan,
  initialStep,
}: WizardContainerProps): React.ReactElement {
  const isEditMode = Boolean(planId)
  const router = useRouter()
  // The journey "Add a stage" was pressed from, carried on `?plan=` the same
  // way /independence carries it. Absent (a first-run account, or a hand-typed
  // URL) means no journey to belong to, and the stage lands ungrouped.
  const requestedJourney = router.query?.[ACTIVE_PLAN_QUERY_PARAM]
  const journeyId = Array.isArray(requestedJourney)
    ? requestedJourney[0]
    : requestedJourney

  // Portfolios the journey draws on, so Assumptions can seed the asset split
  // from what the user actually holds. This came from the Wealth step's
  // `selectedPortfolioIds` until that step was removed; the journey is where
  // the answer really lives, so it is read from there rather than re-offered
  // as a per-stage choice. A stage with no journey seeds from everything.
  const { plans: journeys } = useIndependencePlans()
  const { data: portfolioData } = useSwr<{ data: Portfolio[] }>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const journeyPortfolioIds = useMemo(() => {
    const owned = portfolioData?.data ?? []
    const journey = journeyId
      ? journeys.find((candidate) => candidate.id === journeyId)
      : undefined
    const excluded = new Set(
      parseExcludedPortfolioIds(journey?.excludedPortfolioIds) ?? [],
    )
    return owned.filter((p) => !excluded.has(p.id)).map((p) => p.id)
  }, [portfolioData, journeys, journeyId])
  const [currentStep, setCurrentStep] = useState(() =>
    isEditMode && initialStep && initialStep >= 1 && initialStep <= TOTAL_STEPS
      ? initialStep
      : 1,
  )
  const [clientId, setClientId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set())
  const { preferences } = useUserPreferences()
  const { settings } = useIndependenceSettings()

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
    // Auto-fill plan name if empty on Step 1
    if (currentStep === 1 && !getValues("planName")?.trim()) {
      setValue("planName", "My Independence Plan")
    }

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

      // Calculate planning horizon from user settings
      const settingsLifeExpectancy = settings?.lifeExpectancy ?? 90
      const settingsTargetAge = settings?.targetIndependenceAge ?? 65
      const planningHorizonYears = settingsLifeExpectancy - settingsTargetAge

      // Backend stores decimals (0.07 for 7%), so convert from percentage
      // yearOfBirth and lifeExpectancy are now user-level settings, not plan-level
      const planRequest = buildWizardPlanRequest(formData, {
        isEditMode,
        plan,
        planningHorizonYears,
        clientId,
        independencePlanId: journeyId,
      })

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

      // Sync retirement expenses to the plan - for edit mode, delete existing first
      if (isEditMode) {
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

      // Mark cached data as stale so other pages refetch on next access
      await Promise.all([
        mutate(`/api/independence/plans/${savedPlanId}`),
        mutate(`/api/independence/plans/${savedPlanId}/details`),
        mutate("/api/independence/plans"),
      ])

      if (isEditMode) {
        setIsSubmitting(false)
      } else {
        // New plan → convert into the default phased trio (go-go / slow-go /
        // no-go). force=false: a user who already has a real composite keeps
        // it (the backend rejects and this plan stays single), so manual
        // "Create Plan" never clobbers an existing phased setup. savedPlanId is
        // the go-go after conversion (convert-in-place reuses the base id).
        try {
          await generatePhasedPlans(savedPlanId, false)
        } catch (phaseErr) {
          console.warn("Failed to generate phased plans:", phaseErr)
        }
        router.push(`/independence/plans/${savedPlanId}`)
      }
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
          <AssumptionsStep
            control={control}
            errors={errors}
            setValue={setValue}
            isEditMode={isEditMode}
            portfolioIds={journeyPortfolioIds}
          />
        )
      case 3:
        return (
          <IncomeSourcesStep
            control={control}
            errors={errors}
            isEditMode={isEditMode}
          />
        )
      case 4:
        return (
          <ExpensesStep
            control={control}
            errors={errors}
            setValue={setValue}
            getValues={getValues}
            isEditMode={isEditMode}
          />
        )
      case 5:
        return (
          <LifeEventsStep
            control={control}
            setValue={setValue}
            isEditMode={isEditMode}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg px-6 py-4 sm:px-8 sm:py-5">
        <WizardProgress
          currentStep={currentStep}
          isEditMode={isEditMode}
          stepErrors={stepErrors}
          onStepClick={handleStepClick}
        />

        {currentStep === 1 && <IndependenceSettingsSummary />}

        {currentStep === 1 && <WorkScenarioBanner />}

        {error && (
          <div className="mb-6">
            <Alert>{error}</Alert>
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()}>
          {renderStep()}

          {currentStep === 1 && !isEditMode && (
            <div className="mt-6">
              <ClientSelector clientId={clientId} onChange={setClientId} />
            </div>
          )}

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
