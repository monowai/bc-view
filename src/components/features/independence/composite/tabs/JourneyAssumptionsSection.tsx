import React, { useEffect, useRef, useState } from "react"
import type {
  AssumptionSource,
  IndependencePlan,
  IndependencePlanRequest,
} from "types/independence"
import { useActiveIndependencePlan } from "@hooks/useIndependencePlans"
import { toPercent } from "@lib/independence/conversions"
import { toErrorMessage } from "@lib/formatters"
import Alert from "@components/ui/Alert"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"

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

const SOURCE_LABEL: Record<AssumptionSource, string> = {
  JOURNEY: "Inherits from journey",
  STAGE: "Own assumptions",
  MIXED: "Mixed",
}

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
    return `${field.label} must be between -100% and 100%.`
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
  const { projection } = useCompositeProjectionContext()

  // Only what the user has typed since the page loaded. Everything else reads
  // through to the stored journey, so a save landing elsewhere shows up here
  // without an effect to copy it into local state.
  const [drafts, setDrafts] = useState<Partial<Record<RateKey, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<RateKey, string>>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const timers = useRef<
    Partial<Record<RateKey, ReturnType<typeof setTimeout>>>
  >({})

  useEffect(() => {
    const pending = timers.current
    return () => {
      Object.values(pending).forEach((timer) => {
        if (timer) clearTimeout(timer)
      })
    }
  }, [])

  const handleChange = (field: RateField, raw: string): void => {
    setDrafts((prev) => ({ ...prev, [field.key]: raw }))

    // Cancel first, unconditionally: clearing the box or typing something
    // invalid must also call off the write the previous keystroke queued.
    const queued = timers.current[field.key]
    if (queued) clearTimeout(queued)

    if (raw.trim() === "") {
      // No "clear" verb on the PATCH — an empty box means "stop, I'm not done
      // typing", not "unset this rate".
      setErrors((prev) => ({ ...prev, [field.key]: undefined }))
      return
    }

    const percent = Number(raw)
    const message = validate(field, percent)
    if (message) {
      setErrors((prev) => ({ ...prev, [field.key]: message }))
      return
    }

    setErrors((prev) => ({ ...prev, [field.key]: undefined }))
    setSaveError(null)
    if (!activePlanId) return
    const planId = activePlanId

    timers.current[field.key] = setTimeout(() => {
      const body: IndependencePlanRequest = { [field.key]: percent / 100 }
      update(planId, body).catch((e) =>
        setSaveError(toErrorMessage(e, `Failed to save ${field.label}`)),
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

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="max-w-prose text-sm text-gray-600">
          Set your return, inflation, fee and tax rates once here. Every stage
          inherits these unless it overrides them in its own Assumptions step.
          How each stage splits its money across cash, equity and housing stays
          with that stage.
        </p>

        {saveError && (
          <div className="mt-3">
            <Alert>{saveError}</Alert>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {RATE_FIELDS.map((field) => {
            const value =
              drafts[field.key] ??
              toInputValue(
                activePlan[field.key as keyof IndependencePlan] as
                  number | undefined,
              )
            const error = errors[field.key]
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

      <StageProvenance projection={projection} />
    </div>
  )
}

/**
 * Which stages actually ran on these rates, read from the projection echo.
 *
 * Never worked out here by comparing each stage's stored rates with the
 * journey's: that cannot distinguish MIXED, and a stage whose override
 * happens to match the journey is still overriding. No echo, no claim.
 */
function StageProvenance({
  projection,
}: {
  projection: ReturnType<typeof useCompositeProjectionContext>["projection"]
}): React.ReactElement | null {
  const rows = (projection?.phases ?? []).filter((p) => p.assumptions)
  if (rows.length === 0) return null

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">
        Which stages use these
      </h3>
      <ul className="mt-2 divide-y divide-gray-100">
        {rows.map((row) => (
          <li
            key={row.planId}
            className="flex items-center justify-between gap-4 py-2"
          >
            <span className="min-w-0 truncate text-sm text-gray-900">
              {row.planName}
            </span>
            <span
              className={`shrink-0 text-xs font-medium ${
                row.assumptions?.source === "JOURNEY"
                  ? "text-gray-500"
                  : "text-amber-700"
              }`}
            >
              {SOURCE_LABEL[row.assumptions!.source]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
