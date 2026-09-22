import React, { useEffect, useRef, useState } from "react"
import type {
  CompositePhaseInfo,
  IndependencePlan,
  IndependencePlanRequest,
  PhaseAssumptions,
  RetirementPlan,
} from "types/independence"
import { useActiveIndependencePlan } from "@hooks/useIndependencePlans"
import { toPercent } from "@lib/independence/conversions"
import { toErrorMessage } from "@lib/formatters"
import Alert from "@components/ui/Alert"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"
import { useStageRateSource } from "@hooks/useStageRateSource"
import {
  ProvenanceLabel,
  StageRateSwitch,
  effectiveRatesLine,
} from "../StageRateSource"

/** Matches the write-on-pause used by the other journey editors. */
const SAVE_DEBOUNCE_MS = 1000

/**
 * svc-retire rejects a rate at or beyond ±100%. Enforced here so a typo comes
 * back as a sentence rather than a 400 the user has to interpret.
 */
const RATE_LIMIT = 100

/** The six rates a journey can state. Decimal fractions on the wire. */
type RateKey =
  | "cashReturnRate"
  | "equityReturnRate"
  | "housingReturnRate"
  | "inflationRate"
  | "feeRate"
  | "investmentTaxRate"

interface RateField {
  key: RateKey
  label: string
  /**
   * Returns and inflation can be negative — a lost decade and deflation are
   * both things people model. A fee or a tax rate below zero is not.
   */
  allowNegative: boolean
  hint: string
}

const RATE_FIELDS: RateField[] = [
  {
    key: "cashReturnRate",
    label: "Cash return",
    allowNegative: true,
    hint: "Annual return on the cash side of each stage's allocation.",
  },
  {
    key: "equityReturnRate",
    label: "Equity return",
    allowNegative: true,
    hint: "Annual return on the equity side of each stage's allocation.",
  },
  {
    key: "housingReturnRate",
    label: "Housing return",
    allowNegative: true,
    hint: "Annual capital appreciation on property, run separately from the liquid portfolio.",
  },
  {
    key: "inflationRate",
    label: "Inflation",
    allowNegative: true,
    hint: "Grows expenses year on year.",
  },
  {
    key: "feeRate",
    label: "Fees",
    allowNegative: false,
    hint: "Annual cost of holding the portfolio, taken off the return.",
  },
  {
    key: "investmentTaxRate",
    label: "Investment tax",
    allowNegative: false,
    hint: "Tax on investment gains.",
  },
]

/** Percent for the box, or "" for a rate the journey has never stated. */
function toInputValue(rate: number | undefined): string {
  return rate === undefined || rate === null ? "" : String(toPercent(rate, 0))
}

function validate(field: RateField, percent: number): string | null {
  if (!Number.isFinite(percent)) return `${field.label} must be a number.`
  if (!field.allowNegative && percent < 0) {
    return `${field.label} can't be negative.`
  }
  if (Math.abs(percent) >= RATE_LIMIT) {
    // The bound is exclusive — ±100 itself is refused — so say so. "Between
    // -100% and 100%" describes a rule the rejected value satisfies.
    return `${field.label} must be greater than -100% and less than 100%.`
  }
  return null
}

/**
 * Journey-level assumptions: the rates every stage runs on unless it says
 * otherwise (svc-retire#284).
 *
 * Each box writes one field on its own partial PATCH — the journey PATCH is
 * partial, so an omitted rate is left alone and a single-field save can't
 * clobber the other five. There is no "clear" verb yet (svc-retire#286), so
 * emptying a box cancels the pending write rather than unsetting the rate.
 *
 * Deliberately absent: a blended-return figure. A blend needs an allocation,
 * allocation stays per stage, and the backend echoes no journey-level one —
 * so there is no honest number to show here.
 */
export default function JourneyAssumptionsSection(): React.ReactElement {
  const { activePlan, activePlanId, update } = useActiveIndependencePlan()
  const { projection, plans, refreshProjection } =
    useCompositeProjectionContext()

  // Everything the user has typed but not yet saved, and anything we have to
  // tell them about it — all keyed by the journey it belongs to.
  //
  // Switching journeys is a shallow route push, so this component is
  // re-rendered rather than remounted and unscoped state would show one
  // journey's half-typed number on another journey's box, labelled as that
  // journey's rate. Keying the component to force a remount would fix the
  // display by throwing away the write the first journey still has queued,
  // which is worse. Everything not typed reads straight through to the stored
  // journey, so there is no effect copying server state into local state.
  const [drafts, setDrafts] = useState<
    Record<string, Partial<Record<RateKey, string>>>
  >({})
  const [errors, setErrors] = useState<
    Record<string, Partial<Record<RateKey, string>>>
  >({})
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  // Keyed `${planId}:${rateKey}`, so typing into one journey's Fees box can
  // never call off another journey's pending Fees write.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const pending = timers.current
    return () => {
      Object.values(pending).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const handleChange = (field: RateField, raw: string): void => {
    // No active journey means no box on screen to have typed into, and
    // nowhere to scope the draft to either.
    if (!activePlanId) return
    const planId = activePlanId
    const timerKey = `${planId}:${field.key}`

    setDrafts((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], [field.key]: raw },
    }))

    // Cancel first, unconditionally: clearing the box or typing something
    // invalid must also call off the write the previous keystroke queued.
    const queued = timers.current[timerKey]
    if (queued) clearTimeout(queued)

    const setFieldError = (message: string | undefined): void =>
      setErrors((prev) => ({
        ...prev,
        [planId]: { ...prev[planId], [field.key]: message },
      }))

    if (raw.trim() === "") {
      // No "clear" verb on the PATCH — an empty box means "stop, I'm not done
      // typing", not "unset this rate".
      setFieldError(undefined)
      return
    }

    const percent = Number(raw)
    const message = validate(field, percent)
    if (message) {
      setFieldError(message)
      return
    }

    setFieldError(undefined)
    setSaveErrors((prev) => ({ ...prev, [planId]: "" }))

    timers.current[timerKey] = setTimeout(() => {
      const body: IndependencePlanRequest = { [field.key]: percent / 100 }
      // `planId` is captured deliberately: this write belongs to the journey
      // whose box was typed in, whichever journey is on screen when it fires.
      update(planId, body).catch((e) =>
        setSaveErrors((prev) => ({
          ...prev,
          [planId]: toErrorMessage(e, `Failed to save ${field.label}`),
        })),
      )
    }, SAVE_DEBOUNCE_MS)
  }

  if (!activePlan) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Create a journey first — assumptions belong to one, and every stage
        inside it inherits them.
      </div>
    )
  }

  const planDrafts = drafts[activePlan.id]
  const planErrors = errors[activePlan.id]
  const saveError = saveErrors[activePlan.id]

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="max-w-prose text-sm text-gray-600">
          Set your return, inflation, fee and tax rates once here. Every stage
          runs on these unless you switch it to its own rates below, or in its
          own Assumptions step. How each stage splits its money across cash,
          equity and housing stays with that stage.
        </p>

        {saveError && (
          <div className="mt-3">
            <Alert>{saveError}</Alert>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {RATE_FIELDS.map((field) => {
            const value =
              planDrafts?.[field.key] ??
              toInputValue(
                activePlan[field.key as keyof IndependencePlan] as
                  number | undefined,
              )
            const error = planErrors?.[field.key]
            return (
              <div key={field.key}>
                <label
                  htmlFor={field.key}
                  className="block text-sm font-medium text-gray-700"
                >
                  {field.label}
                </label>
                <div className="relative mt-1">
                  <input
                    id={field.key}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={value}
                    placeholder="Each stage uses its own"
                    onChange={(e) => handleChange(field, e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 pr-8 font-mono text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-1 focus:ring-independence-500 ${
                      error
                        ? "border-red-500"
                        : "border-gray-300 focus:border-independence-500"
                    }`}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-2 text-sm text-gray-400"
                  >
                    %
                  </span>
                </div>
                {error ? (
                  <p role="alert" className="mt-1 text-sm text-red-600">
                    {error}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">{field.hint}</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <StageAssumptionSources
        projection={projection}
        plans={plans}
        refreshProjection={refreshProjection}
      />
    </div>
  )
}

/**
 * Which rates each stage runs on, with the choice right beside the answer.
 *
 * Two things per stage, deliberately kept apart:
 *
 * - The **choice** — the switch — is the stage's own `assumptionsInherited`
 *   flag, read from the stored plan. This is what the user controls.
 * - The **provenance** — the label — is read from the projection echo, never
 *   worked out here by comparing rate sets. A stage set to inherit from a
 *   journey that states nothing still runs on its own figures (STAGE), and a
 *   journey that states some rates leaves the stage MIXED; both are answers
 *   only the backend can give.
 *
 * The effective rates are echoed too, so switching a stage over shows what
 * it now runs on rather than asking the user to go and look. The same
 * control lives on each stage's drawer on the Stages tab, through the same
 * hook, so the two never disagree about what a flip does.
 */
function StageAssumptionSources({
  projection,
  plans,
  refreshProjection,
}: {
  projection: ReturnType<typeof useCompositeProjectionContext>["projection"]
  plans: RetirementPlan[]
  refreshProjection: () => void
}): React.ReactElement | null {
  const rateSource = useStageRateSource(refreshProjection)

  // A type-guard filter, not a truthiness one: it narrows the rows so the
  // label and the tone below both read `row.assumptions.source` outright,
  // with no `!` claiming something the type doesn't say.
  const rows = (projection?.phases ?? []).filter(
    (p): p is CompositePhaseInfo & { assumptions: PhaseAssumptions } =>
      p.assumptions != null,
  )
  if (rows.length === 0) return null

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">
        Which rates each stage uses
      </h3>
      <p className="mt-1 max-w-prose text-xs text-gray-500">
        Off, a stage runs on the rates above. On, it keeps the figures set in
        its own Assumptions step — the same switch as in the stage wizard.
      </p>
      <ul className="mt-2 divide-y divide-gray-100">
        {rows.map((row) => {
          const plan = plans.find((p) => p.id === row.planId)
          // Same normalisation as the stage wizard: a legacy row that never
          // carried the flag reads as inheriting, matching how svc-retire
          // resolves it.
          const inherits = plan?.assumptionsInherited !== false
          const error = rateSource.errorFor(row.planId)
          return (
            <li key={row.planId} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {row.planName}
                  </p>
                  <p className="mt-0.5">
                    <ProvenanceLabel source={row.assumptions.source} />
                  </p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-gray-500">
                    {effectiveRatesLine(row.assumptions)}
                  </p>
                </div>
                {/* No plan, no switch: a switch drawn from a default would
                    sit at "inherits" beside a label that may say otherwise. */}
                {plan && (
                  <div className="mt-0.5">
                    <StageRateSwitch
                      label={`Own rates for ${row.planName}`}
                      inherits={inherits}
                      disabled={rateSource.isSaving(row.planId)}
                      onChange={(next) =>
                        void rateSource.setInherits(plan, next)
                      }
                    />
                  </div>
                )}
              </div>
              {error && (
                <div className="mt-2">
                  <Alert>{error}</Alert>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
