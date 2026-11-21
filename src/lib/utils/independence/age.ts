/**
 * Compute the user's current age in whole years from any object carrying
 * the standard demographic shape (yearOfBirth + optional monthOfBirth).
 * Returns undefined when yearOfBirth is missing so callers can branch on
 * "no profile yet" vs "have a profile".
 *
 * Accepts both `UserIndependenceSettings` (svc-retire) and `UserPreferences`
 * (svc-data) since profile demographics now live on both — UserPreferences
 * is the denormalised read copy that screens scoped to svc-data (Edit Asset,
 * holdings) can read without a runtime call to svc-retire. Same year-
 * rollover rule applies regardless of source: subtract one if we haven't
 * passed the birth month yet.
 */
export interface ProfileDemographics {
  yearOfBirth?: number
  monthOfBirth?: number
}

export function currentAgeFromSettings(
  settings: ProfileDemographics | undefined | null,
  // Callers that need to stay React-Compiler-memoizable (calling this from
  // a hook/component body) should hoist their own `new Date()` at the top
  // of the render and pass it in — an opaque `new Date()` buried inside an
  // imported function call reads as an impure/non-deterministic call to
  // the compiler and can block memoization of unrelated callbacks further
  // down the same component (see useCompositeProjection.ts).
  now: Date = new Date(),
): number | undefined {
  const yob = settings?.yearOfBirth
  if (!yob) return undefined
  let age = now.getFullYear() - Number(yob)
  const monthOfBirth = settings?.monthOfBirth
  // Months stored 1-based; getMonth() is 0-based.
  if (monthOfBirth && now.getMonth() + 1 < Number(monthOfBirth)) {
    age -= 1
  }
  return age
}

/** Settings fields that decide the plan's retirement age. */
export interface RetirementDemographics extends ProfileDemographics {
  targetIndependenceAge?: number
  /** yyyy-MM-dd the user retired, or null/undefined while working. */
  retiredOn?: string | null
}

/**
 * The age the plan treats as the retirement age. A retired user's plan
 * retires at the age they were on `retiredOn` (same birth-month rule as
 * `currentAgeFromSettings`); everyone else's at `targetIndependenceAge`.
 * Mirrors svc-retire so first paint agrees with the projection echo.
 * A `retiredOn` after `now` is ignored — the backend rejects one anyway.
 */
export function planRetirementAge(
  settings: RetirementDemographics | undefined | null,
  now: Date = new Date(),
): number | undefined {
  const retiredOn = parseIsoDate(settings?.retiredOn)
  if (retiredOn && settings?.yearOfBirth && retiredOn <= now) {
    return currentAgeFromSettings(settings, retiredOn)
  }
  return settings?.targetIndependenceAge
}

/** Parse yyyy-MM-dd as a local date (no UTC shift); undefined when absent or malformed. */
function parseIsoDate(value: string | null | undefined): Date | undefined {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** Ages echoed back on `RetirementProjection.planInputs` (see types/independence.d.ts). */
export interface ProjectionEchoedAges {
  currentAge?: number
  retirementAge?: number
  lifeExpectancy?: number
}

/** The locally (client-)derived ages, used only until a projection lands. */
export interface LocalAges {
  currentAge: number | undefined
  retirementAge: number
  lifeExpectancy: number
}

export interface DisplayAges {
  currentAge: number | undefined
  retirementAge: number
  lifeExpectancy: number
}

/**
 * Resolve the ages to show on the plan detail page.
 *
 * The backend (svc-retire) is authoritative: every projection response
 * echoes the demographics it actually used via `RetirementProjection.
 * planInputs` (resolved from the plan OWNER's settings — important for
 * shared plans, but also the single source of truth for owned plans).
 * bc-view must not re-derive the same fact client-side and risk drifting
 * out of step with the backend's derivation rules (bc-view #1144) — prefer
 * the echo, field-by-field, over the locally computed value. The local
 * value remains only as a fallback for first paint, before any projection
 * has landed.
 */
export function resolveDisplayAges(
  echoed: ProjectionEchoedAges | undefined,
  local: LocalAges,
): DisplayAges {
  return {
    currentAge: echoed?.currentAge ?? local.currentAge,
    retirementAge: echoed?.retirementAge ?? local.retirementAge,
    lifeExpectancy: echoed?.lifeExpectancy ?? local.lifeExpectancy,
  }
}
