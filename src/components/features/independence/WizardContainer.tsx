import React, { useState, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import { useRouter } from "next/router"
import Link from "next/link"
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
  serializeAssetDisposals,
  serializeLifeEvents,
  toPlanRequestPayload,
} from "@lib/independence/planHelpers"
import { portfoliosForJourney } from "@lib/independence/journeyPhases"
import { WizardFormData, RetirementPlan } from "types/independence"
import { Portfolio } from "types/beancounter"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { resolveReturnTo } from "@lib/independence/editPhase"
import { toErrorMessage } from "@lib/formatters"
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
    // Sent on both paths. The rate fields below still go out when the stage
    // inherits — the engine ignores them then, and keeping the payload shape
    // stable means flipping the switch back restores what the user last typed
    // rather than backend defaults.
    assumptionsInherited: formData.assumptionsInherited,
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

/**
 * svc-retire refuses to phase a stage whose owner has given neither a year of
 * birth nor a target independence age (`PhasedIndependenceService`) — there is
 * no age axis to cut the phases on. A create that ignores that saves a stage
 * and no journey, which is the one outcome the wizard exists to avoid.
 */
export const PHASING_PREREQUISITE_MESSAGE =
  "Set your date of birth or target independence age before creating a stage — without one the stage cannot be phased."

/** Names what survived, then what to do about the rest. */
export const phaseFailureMessage = (reason: string): string =>
  `Your stage is saved, but it could not be phased: ${reason}.`

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
  // the answer really lives, so it is read from there instead.
  //
  // `?plan=` only exists on the create path. Edit mode navigates to
  // /independence/wizard/{planId} with no query at all, so the stage's own
  // `independencePlanId` is the link that has to carry it there — without it,
  // editing seeded the allocation from every portfolio the user owns and
  // quietly ignored the journey's exclusions.
  const { plans: journeys, isLoading: journeysLoading } = useIndependencePlans()
  const { data: portfolioData } = useSwr<{ data: Portfolio[] }>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const effectiveJourneyId = journeyId ?? plan?.independencePlanId
  // The journey whose assumptions this stage inherits. Undefined while the
  // journeys request is in flight and for a stage with no journey at all —
  // AssumptionsStep treats both as "nothing to inherit from" and edits the
  // stage's own rates, which is the only honest thing to show either way.
  const journey = useMemo(
    () =>
      effectiveJourneyId
        ? journeys.find((j) => j.id === effectiveJourneyId)
        : undefined,
    [journeys, effectiveJourneyId],
  )
  const journeyPortfolioIds = useMemo(
    () =>
      portfoliosForJourney({
        portfolios: portfolioData?.data ?? [],
        journeys,
        journeyId: effectiveJourneyId,
        journeysLoading,
      }),
    [portfolioData, journeys, effectiveJourneyId, journeysLoading],
  )
  const [currentStep, setCurrentStep] = useState(() =>
    isEditMode && initialStep && initialStep >= 1 && initialStep <= TOTAL_STEPS
      ? initialStep
      : 1,
  )
  const [clientId, setClientId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set())
  // Which step's changes are saved, cleared the moment that stops being true.
  // Keying it to the step only *hid* the message elsewhere: returning to the
  // step brought back a "Saved" that no longer described the form.
  const [savedStep, setSavedStep] = useState<number | null>(null)
  // A stage that saved but could not be phased. Separate from `error`, which
  // means "nothing was written" — conflating them would tell the user to try
  // again and quietly create a second stage.
  const [phaseError, setPhaseError] = useState<string | null>(null)
  const { preferences } = useUserPreferences()
  const { settings, isLoading: settingsLoading } = useIndependenceSettings()

  // Create only. An existing stage is being edited, not phased, so an
  // incomplete profile is not this screen's business.
  const phasingBlocked =
    !isEditMode &&
    !settingsLoading &&
    !settings?.yearOfBirth &&
    !settings?.targetIndependenceAge

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

  // Any move off the step, and any edit on it, ends the save it described.
  const handleNext = async (): Promise<void> => {
    setSavedStep(null)
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
    setSavedStep(null)
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleStepClick = (step: number): void => {
    setSavedStep(null)
    // In edit mode, allow navigating to any step directly
    if (isEditMode && step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step)
    }
  }

  // Both exits land in the same place: where the reader was when they chose
  // to edit. Previously Cancel and Save both pushed the stage drill-down
  // regardless of origin, so editing a stage from the plan moved the reader to
  // a different page than the one they were reading — and the journey and
  // section they had open, which live in the query string, were lost with it.
  const returnTo = resolveReturnTo(router.query?.returnTo)
  // Whether a caller actually named an origin, as opposed to the fallback. The
  // create path has no origin to return to when entered from "Add a stage", and
  // dropping the reader on the plan list after several minutes of work loses
  // the hand-off to the plan they just made.
  const hasNamedOrigin = router.query?.returnTo !== undefined

  const handleCancel = (): void => {
    router.push(returnTo)
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
    // The Save button is disabled for this, but Next on the last step lands
    // here too — refusing in one place keeps both doors honest.
    if (phasingBlocked) {
      setError(PHASING_PREREQUISITE_MESSAGE)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setPhaseError(null)

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
        // "Save Plan" on the last step is the finisher, so it completes the
        // detour and hands the reader back their plan. The secondary "Save"
        // on earlier steps means "save and keep editing" — returning there
        // would interrupt the edit, so it acknowledges in place instead.
        // Until now it did neither: the click mutated caches and nothing on
        // screen moved.
        if (currentStep === TOTAL_STEPS) {
          router.push(returnTo)
        } else {
          setSavedStep(currentStep)
        }
      } else {
        // New plan → convert into the default phased trio (go-go / slow-go /
        // no-go). force=false: a user who already has a real composite keeps
        // it (the backend rejects and this plan stays single), so manual
        // "Create Plan" never clobbers an existing phased setup. savedPlanId is
        // the go-go after conversion (convert-in-place reuses the base id).
        //
        // A refusal used to be console.warn'd and navigated past, so the user
        // landed on a stage drill-down with no journey and nothing saying why.
        // Of the two places to say it, this one is chosen: the wizard's last
        // step is where the user still is, it needs no query-string or
        // cross-page state to survive the hop, and the stage is already saved
        // — so there is nothing to lose by staying. The banner links on to
        // /independence, where the phasing offer lives.
        try {
          await generatePhasedPlans(savedPlanId, false)
        } catch (phaseErr) {
          setPhaseError(
            phaseFailureMessage(
              toErrorMessage(phaseErr, "phasing was refused"),
            ),
          )
          setIsSubmitting(false)
          return
        }
        // Finish at the plan just created unless the caller said where to go.
        router.push(
          hasNamedOrigin ? returnTo : `/independence/plans/${savedPlanId}`,
        )
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
            journey={journey}
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

        {/* The summary above already shows "Not set" for Year of Birth; this
            says what that costs and where to fix it. */}
        {currentStep === 1 && phasingBlocked && (
          <div className="mb-6">
            <Alert variant="warning">
              {PHASING_PREREQUISITE_MESSAGE}{" "}
              <Link
                href="/independence?view=profile"
                className="font-medium underline"
              >
                Set it on your profile
              </Link>
              .
            </Alert>
          </div>
        )}

        {currentStep === 1 && <WorkScenarioBanner />}

        {error && (
          <div className="mb-6">
            <Alert>{error}</Alert>
          </div>
        )}

        {phaseError && (
          <div className="mb-6">
            <Alert variant="warning">
              {phaseError}{" "}
              <Link href="/independence" className="font-medium underline">
                Phase it from the Stages list
              </Link>
              .
            </Alert>
          </div>
        )}

        <form
          onSubmit={(e) => e.preventDefault()}
          onChange={() => setSavedStep(null)}
        >
          {renderStep()}

          {currentStep === 1 && !isEditMode && (
            <div className="mt-6">
              <ClientSelector clientId={clientId} onChange={setClientId} />
            </div>
          )}

          {savedStep === currentStep && (
            <p role="status" className="mt-4 text-sm text-gain">
              <i aria-hidden="true" className="fas fa-check mr-1.5" />
              Saved. Keep going, or finish on the last step.
            </p>
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
            saveDisabled={phasingBlocked}
          />
        </form>
      </div>
    </div>
  )
}
