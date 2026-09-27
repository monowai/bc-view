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

/**
 * Same reasoning as RATE_LIMIT, for the target-balance box: catch an
 * obviously-mistyped amount (an extra zero or three) client-side, as a
 * sentence, rather than letting it reach the PATCH. A trillion in the plan
 * currency is already an absurd target, so the bound doubles as a
 * safe-integer guard — nothing this side of it can overflow.
 */
const TARGET_LIMIT = 1e12

/** The six rates a journey can state. Decimal fractions on the wire. */
type RateKey =
  | "cashReturnRate"
  | "equityReturnRate"
  | "housingReturnRate"
  | "inflationRate"
  | "feeRate"
  | "investmentTaxRate"

/**
 * Draft/error storage is shared between the six percentage rates and the
 * target-balance box below — same per-journey keying, same debounce, same
 * "empty means not done typing" rule — so both share one `FieldKey` union
 * rather than a second, parallel state shape.
 */
type FieldKey = RateKey | "targetBalance"

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
    Record<string, Partial<Record<FieldKey, string>>>
  >({})
  const [errors, setErrors] = useState<
    Record<string, Partial<Record<FieldKey, string>>>
  >({})
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  // Keyed `${planId}:${fieldKey}`, so typing into one journey's Fees box can
  // never call off another journey's pending Fees write.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const pending = timers.current
    return () => {
      Object.values(pending).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  /**
   * A raw box value, turned into either the wire value to send or the
   * message to show instead of sending it.
   */
  const parseField = (
    value: number,
    message: string | null,
  ): { valid: true; value: number } | { valid: false; message: string } =>
    message ? { valid: false, message } : { valid: true, value }

  /**
   * The debounce/error orchestration shared by every per-journey box below:
   * draft echo, per-field debounce timer, "empty box cancels the pending
   * write" rule (no "clear" verb yet — svc-retire#286), and routing a save
   * failure into the shared per-journey save-error banner. `parse` turns
   * the raw string into a wire value or a rejection message; `toBody` turns
   * that wire value into the PATCH body's one key. Kept in one place so a
   * future change to debounce or error-clearing semantics can't land on one
   * box and drift on the other (OCR #4113948845).
   */
  const scheduleFieldWrite = (
    fieldKey: FieldKey,
    raw: string,
    label: string,
    parse: (
      raw: string,
    ) => { valid: true; value: number } | { valid: false; message: string },
    toBody: (value: number) => IndependencePlanRequest,
  ): void => {
    // No active journey means no box on screen to have typed into, and
    // nowhere to scope the draft to either.
    if (!activePlanId) return
    const planId = activePlanId
    const timerKey = `${planId}:${fieldKey}`

    setDrafts((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], [fieldKey]: raw },
    }))

    // Cancel first, unconditionally: clearing the box or typing something
    // invalid must also call off the write the previous keystroke queued.
    const queued = timers.current[timerKey]
    if (queued) clearTimeout(queued)

    const setFieldError = (message: string | undefined): void =>
      setErrors((prev) => ({
        ...prev,
        [planId]: { ...prev[planId], [fieldKey]: message },
      }))

    if (raw.trim() === "") {
      // No "clear" verb on the PATCH — an empty box means "stop, I'm not done
      // typing", not "unset this field".
      setFieldError(undefined)
      return
    }

    const result = parse(raw)
    if (!result.valid) {
      setFieldError(result.message)
      return
    }

    setFieldError(undefined)
    setSaveErrors((prev) => ({ ...prev, [planId]: "" }))

    timers.current[timerKey] = setTimeout(() => {
      // `planId` is captured deliberately: this write belongs to the journey
      // whose box was typed in, whichever journey is on screen when it fires.
      update(planId, toBody(result.value)).catch((e) =>
        setSaveErrors((prev) => ({
          ...prev,
          [planId]: toErrorMessage(e, `Failed to save ${label}`),
        })),
      )
    }, SAVE_DEBOUNCE_MS)
  }

  const handleChange = (field: RateField, raw: string): void => {
    scheduleFieldWrite(
      field.key,
      raw,
      field.label,
      (r) => parseField(Number(r), validate(field, Number(r))),
      (percent) => ({ [field.key]: percent / 100 }),
    )
  }

  /**
   * The journey-level target ending balance (svc-retire#282) — a plain
   * amount in the plan currency rather than a percentage, so it gets its
   * own validation and its own body key, but shares
   * {@link scheduleFieldWrite}'s debounce/error orchestration with
   * {@link handleChange}.
   */
  const handleTargetChange = (raw: string): void => {
    scheduleFieldWrite(
      "targetBalance",
      raw,
      "Target ending balance",
      (r) => {
        const amount = Number(r)
        if (!Number.isFinite(amount)) {
          return {
            valid: false,
            message: "Target ending balance must be a number.",
          }
        }
        if (amount < 0) {
          return {
            valid: false,
            message: "Target ending balance can't be negative.",
          }
        }
        if (amount >= TARGET_LIMIT) {
          return {
            valid: false,
            message:
              "Target ending balance must be less than 1,000,000,000,000.",
          }
        }
        return { valid: true, value: amount }
      },
      (amount) => ({ targetBalance: amount }),
    )
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
  // Not a percent — the journey's target ending balance is a plain amount
  // in the plan currency, so it reads straight from the stored value with
  // no /100 conversion.
  const targetValue =
    planDrafts?.targetBalance ??
    (activePlan.targetBalance != null ? String(activePlan.targetBalance) : "")
  const targetError = planErrors?.targetBalance
  // The target is denominated in the phase plans' currency, not this
  // journey's displayCurrency (types/independence.d.ts) — so the code shown
  // beside the label has to come from a phase plan first. The primary phase
  // stands in for "the" plan currency when one is flagged; otherwise the
  // first loaded phase is as good a guess as any. Falling back further to
  // the journey's own displayCurrency is still a guess, so when neither is
  // known the label carries no currency at all.
  //
  // Shown as the ISO CODE, never a symbol: currencySymbolFor falls back to
  // a literal "$" for any code outside its local map (MYR, THB, IDR, …),
  // which would silently mislabel an unmapped currency as USD
  // (OCR #4114035790) — exactly the wrong-symbol case this was meant to
  // avoid.
  const journeyCurrency =
    (plans.find((p) => p.isPrimary) ?? plans[0])?.expensesCurrency ??
    activePlan.displayCurrency

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

        <div className="mt-4 max-w-xs border-t border-gray-100 pt-4">
          <label
            htmlFor="targetBalance"
            className="block text-sm font-medium text-gray-700"
          >
            Target ending balance
            {journeyCurrency ? ` (${journeyCurrency})` : ""}
          </label>
          <input
            id="targetBalance"
            type="number"
            inputMode="decimal"
            step="1000"
            min={0}
            value={targetValue}
            placeholder="0"
            onChange={(e) => handleTargetChange(e.target.value)}
            className={`mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-1 focus:ring-independence-500 ${
              targetError
                ? "border-red-500"
                : "border-gray-300 focus:border-independence-500"
            }`}
          />
          {targetError ? (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {targetError}
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              What you want left at the end of the journey, in the plan
              currency. Leave 0 for none.
            </p>
          )}
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
