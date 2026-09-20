import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Alert from "@components/ui/Alert"
import OnboardingProgress from "@components/features/onboarding/OnboardingProgress"
import { useLifestyleOutlook } from "@components/features/onboarding/useLifestyleOutlook"
import LifestyleSummary from "@components/features/independence/LifestyleSummary"
import SpendingFields from "./SpendingFields"
import WorkFields from "./WorkFields"
import TargetFields, {
  parseTargetAge,
  TARGET_AGE_RANGE_MESSAGE,
} from "./TargetFields"
import { saveOnboardingExpenses } from "@lib/onboarding/saveIndependenceExpenses"
import { generatePhasedPlans } from "@lib/onboarding/generatePhasedPlans"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import { currencySymbolFor, toErrorMessage } from "@lib/formatters"
import { phaseFailureMessage } from "@lib/independence/phasing"
import { readErrorMessage } from "@utils/api/readErrorMessage"
import { WorkScenario } from "types/independence"

export const SETUP_STEPS = [
  { id: 1, label: "Spending" },
  { id: 2, label: "Work" },
  { id: 3, label: "Target" },
  { id: 4, label: "Done" },
]

const WORK_STEP = 2
const TARGET_STEP = 3
const PAYOFF_STEP = 4
const DEFAULT_PLAN_NAME = "My Independence Plan"
const DEFAULT_TARGET_AGE = "65"

/**
 * The guided door to a first independence plan: the same questions onboarding
 * asks in its plan step, one decision per screen, ending on the same payoff.
 *
 * It does **not** ask for a date of birth. svc-data owns that (see
 * bc-claude/USER_PROFILE.md) and a target age alone is enough for svc-retire
 * to phase the stage — so a missing birth date is a note on step 3, not a
 * gate.
 *
 * Unlike the old one-screen form, this finishes what it starts: the stage is
 * phased into the go-go / slow-go / no-go trio before the user is shown
 * anything, so both first-stage doors end in a journey.
 */
export default function SetupWizard(): React.ReactElement {
  const { preferences } = useUserPreferences()
  const { settings } = useIndependenceSettings()

  const [step, setStep] = useState(1)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
  const [medicalExpenses, setMedicalExpenses] = useState(0)
  const [isWorking, setIsWorking] = useState(true)
  const [workingIncomeMonthly, setWorkingIncomeMonthly] = useState(0)
  const [workingExpensesMonthly, setWorkingExpensesMonthly] = useState(0)
  const [taxesMonthly, setTaxesMonthly] = useState(0)
  const [bonusMonthly, setBonusMonthly] = useState(0)
  const [investmentAllocationPercent, setInvestmentAllocationPercent] =
    useState(80)
  const [planName, setPlanName] = useState(DEFAULT_PLAN_NAME)
  const [targetIndependenceAge, setTargetIndependenceAge] =
    useState(DEFAULT_TARGET_AGE)
  const [existingScenarioId, setExistingScenarioId] = useState<string | null>(
    null,
  )
  const [targetAgeError, setTargetAgeError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phaseError, setPhaseError] = useState<string | null>(null)
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null)

  // Adopt the stored target age the first time settings arrive. Render-phase
  // "store previous value" pattern rather than an effect, so it runs once
  // without a set-state-in-effect (and without a React Compiler bailout).
  const [prefilledTarget, setPrefilledTarget] = useState(false)
  if (!prefilledTarget && settings) {
    setPrefilledTarget(true)
    if (settings.targetIndependenceAge) {
      setTargetIndependenceAge(String(settings.targetIndependenceAge))
    }
  }

  // One-time load of the current work scenario. A ref (not state) so flipping
  // it neither triggers a render nor counts as a set-state-in-effect.
  const loadedScenario = useRef(false)
  useEffect(() => {
    if (loadedScenario.current) return
    loadedScenario.current = true

    fetch("/api/independence/work-scenarios")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { data?: WorkScenario[] } | null) => {
        const scenarios = body?.data ?? []
        const current = scenarios.find((s) => s.isCurrent) ?? scenarios[0]
        if (!current) return
        setExistingScenarioId(current.id)
        setWorkingIncomeMonthly(current.workingIncomeMonthly ?? 0)
        setWorkingExpensesMonthly(current.workingExpensesMonthly ?? 0)
        setTaxesMonthly(current.taxesMonthly ?? 0)
        setBonusMonthly(current.bonusMonthly ?? 0)
        // The API stores allocation as a decimal fraction; the slider is 0-100.
        setInvestmentAllocationPercent(
          (current.investmentAllocationPercent ?? 0.8) * 100,
        )
      })
      .catch(() => undefined)
  }, [])

  const currency = preferences?.baseCurrencyCode ?? "USD"

  /** Returns the reason the write was refused, or null when it succeeded. */
  const saveWorkScenario = async (): Promise<string | null> => {
    if (!isWorking) return null
    const payload = {
      name: "Working Situation",
      currency,
      workingIncomeMonthly,
      workingExpensesMonthly,
      taxesMonthly,
      bonusMonthly,
      investmentAllocationPercent: investmentAllocationPercent / 100,
    }
    // Update the scenario the user already has rather than leaving them with
    // two "Working Situation"s, only one of which is current.
    const res = await fetch(
      existingScenarioId
        ? `/api/independence/work-scenarios/${existingScenarioId}`
        : "/api/independence/work-scenarios",
      {
        method: existingScenarioId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    )
    return res.ok
      ? null
      : readErrorMessage(res, "Failed to save your working situation")
  }

  const handleCreate = async (targetAge: number): Promise<void> => {
    setIsSubmitting(true)
    setError(null)
    setPhaseError(null)
    try {
      // Every write below is checked before the next one runs. Each is a
      // prerequisite of what follows — the target age is what phasing cuts on,
      // and a stage created after a silently dropped write would resurface as
      // a confusing phase refusal rather than the thing that actually failed.
      //
      // svc-retire's own settings row is what PhasedIndependenceService reads
      // (`settings.targetIndependenceAge`), falling back to svc-data only when
      // that row is null — so PATCHing /api/me here would be ignored for any
      // user who already has a settings row. svc-retire mirrors the value back
      // to svc-data itself.
      const settingsResponse = await fetch("/api/independence/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetIndependenceAge: targetAge }),
      })
      if (!settingsResponse.ok) {
        setError(
          await readErrorMessage(
            settingsResponse,
            "Failed to save your target independence age",
          ),
        )
        return
      }

      const workFailure = await saveWorkScenario()
      if (workFailure) {
        setError(workFailure)
        // Back to the figures that were refused, rather than leaving the
        // message stranded on a step that cannot act on it.
        setStep(WORK_STEP)
        return
      }

      const planResponse = await fetch("/api/independence/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planName.trim() || DEFAULT_PLAN_NAME,
          planningHorizonYears: 90 - targetAge,
          lifeExpectancy: 90,
          monthlyExpenses: monthlyExpenses + medicalExpenses,
          expensesCurrency: currency,
          cashReturnRate: 0.03,
          equityReturnRate: 0.08,
          housingReturnRate: 0.04,
          inflationRate: 0.025,
          cashAllocation: 0.2,
          equityAllocation: 0.8,
          housingAllocation: 0.0,
          pensionMonthly: 0,
          socialSecurityMonthly: 0,
          otherIncomeMonthly: 0,
          // The working figures live on the work scenario, not the stage —
          // same split onboarding uses.
          workingIncomeMonthly: 0,
          workingExpensesMonthly: 0,
          taxesMonthly: 0,
          bonusMonthly: 0,
          investmentAllocationPercent: 0.8,
        }),
      })
      if (!planResponse.ok) {
        setError(
          await readErrorMessage(
            planResponse,
            "Failed to create independence plan",
          ),
        )
        return
      }

      const body = await planResponse.json()
      const planId = body?.data?.id ?? body?.id
      if (!planId) {
        throw new Error("Failed to create independence plan")
      }
      setCreatedPlanId(planId)

      // Categorised rows, so the plan opens with real lines and the phased
      // generator can ramp medical separately from discretionary spend.
      try {
        await saveOnboardingExpenses(
          planId,
          monthlyExpenses,
          medicalExpenses,
          currency,
        )
      } catch (expenseErr) {
        console.warn("Failed to save setup retirement expenses:", expenseErr)
      }

      // Both first-stage doors end in a phased journey. force=false so a user
      // who already has a real composite keeps it, exactly as the wizard door
      // does. A refusal is shown on the payoff step — the stage is saved, so
      // hiding the reason would leave an unexplained missing journey.
      try {
        await generatePhasedPlans(planId, false)
      } catch (phaseErr) {
        setPhaseError(
          phaseFailureMessage(toErrorMessage(phaseErr, "phasing was refused")),
        )
      }
      setStep(PAYOFF_STEP)
    } catch (err) {
      setError(toErrorMessage(err, "Something went wrong"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleContinue = async (): Promise<void> => {
    if (step === TARGET_STEP) {
      // Validated here rather than on every keystroke: a half-typed age is not
      // yet a mistake, and the browser's own `min`/`max` never fire on a value
      // React put there.
      const targetAge = parseTargetAge(targetIndependenceAge)
      if (targetAge === null) {
        setTargetAgeError(TARGET_AGE_RANGE_MESSAGE)
        return
      }
      setTargetAgeError(null)
      await handleCreate(targetAge)
      return
    }
    setStep((prev) => prev + 1)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Create your independence plan
        </h1>
        <p className="text-gray-600">
          Three questions, then we&apos;ll show you the life it buys.
        </p>
      </div>

      <OnboardingProgress currentStep={step} steps={SETUP_STEPS} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900">
              What will you spend?
            </h2>
            <SpendingFields
              monthlyExpenses={monthlyExpenses}
              medicalExpenses={medicalExpenses}
              currency={currency}
              onMonthlyExpensesChange={setMonthlyExpenses}
              onMedicalExpensesChange={setMedicalExpenses}
            />
          </>
        )}

        {step === WORK_STEP && (
          <>
            <h2 className="text-lg font-semibold text-gray-900">
              What are you earning now?
            </h2>
            <p className="text-sm text-gray-500">
              How much you earn and spend today, so we can project your savings
              runway.
            </p>
            {isWorking ? (
              <WorkFields
                workingIncomeMonthly={workingIncomeMonthly}
                workingExpensesMonthly={workingExpensesMonthly}
                taxesMonthly={taxesMonthly}
                bonusMonthly={bonusMonthly}
                investmentAllocationPercent={investmentAllocationPercent}
                currency={currency}
                onWorkingIncomeMonthlyChange={setWorkingIncomeMonthly}
                onWorkingExpensesMonthlyChange={setWorkingExpensesMonthly}
                onTaxesMonthlyChange={setTaxesMonthly}
                onBonusMonthlyChange={setBonusMonthly}
                onInvestmentAllocationPercentChange={
                  setInvestmentAllocationPercent
                }
              />
            ) : (
              <p className="text-sm text-gray-600">
                No working situation will be recorded. You can add one later
                from the Scenarios tab.
              </p>
            )}
            <button
              type="button"
              onClick={() => setIsWorking(!isWorking)}
              className="text-sm font-medium text-independence-600 hover:text-independence-700"
            >
              {isWorking ? "I'm not working" : "Actually, I am working"}
            </button>
          </>
        )}

        {step === TARGET_STEP && (
          <>
            <h2 className="text-lg font-semibold text-gray-900">
              When do you want to be independent?
            </h2>
            <TargetFields
              planName={planName}
              targetIndependenceAge={targetIndependenceAge}
              hasDateOfBirth={Boolean(settings?.yearOfBirth)}
              targetAgeError={targetAgeError}
              onPlanNameChange={setPlanName}
              onTargetIndependenceAgeChange={setTargetIndependenceAge}
            />
          </>
        )}

        {step === PAYOFF_STEP && (
          <PayoffStep
            planId={createdPlanId}
            currency={currency}
            planName={planName.trim() || DEFAULT_PLAN_NAME}
            phaseError={phaseError}
          />
        )}

        {error && <Alert variant="error">{error}</Alert>}

        {step !== PAYOFF_STEP && (
          <div className="flex gap-3 pt-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => prev - 1)}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-60"
              >
                Back
              </button>
            ) : (
              <Link
                href="/independence"
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-center"
              >
                Skip for now
              </Link>
            )}
            <button
              type="button"
              onClick={handleContinue}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-independence-600 text-white rounded-lg hover:bg-independence-700 font-medium disabled:opacity-60"
            >
              {step === TARGET_STEP
                ? isSubmitting
                  ? "Creating..."
                  : "Create my plan"
                : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface PayoffStepProps {
  planId: string | null
  currency: string
  planName: string
  phaseError: string | null
}

/** The same moment onboarding ends on: what the plan buys, not a receipt. */
function PayoffStep({
  planId,
  currency,
  planName,
  phaseError,
}: PayoffStepProps): React.ReactElement {
  const { model, isLoading } = useLifestyleOutlook(planId, currency)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-1">
          <i
            aria-hidden="true"
            className="fas fa-check-circle text-green-500"
          />
          Your plan is ready
        </h2>
        <p className="text-sm text-gray-600">{`Created: ${planName}`}</p>
      </div>

      {/* The shared sentence names the saved state and the reason; where to
          go next is this surface's own answer, so it lives here rather than
          in the string. */}
      {phaseError && (
        <Alert variant="warning">
          {phaseError} Set your target age or date of birth, then{" "}
          <Link href="/independence" className="font-medium underline">
            phase it from the Stages list
          </Link>
          .
        </Alert>
      )}

      {planId && (model || isLoading) && (
        <LifestyleSummary
          variant="payoff"
          model={model}
          isLoading={isLoading && !model}
          currencySymbol={currencySymbolFor(currency)}
        />
      )}

      <Link
        href="/independence"
        className="block w-full px-6 py-3 bg-independence-600 text-white rounded-lg hover:bg-independence-700 font-medium text-center"
      >
        See your plan
      </Link>
    </div>
  )
}
