// ============ Independence Plan (journey) ============
/**
 * A whole journey the user maps out — "With Property" against "No Property".
 * Owns its composite timeline, display currency, work scenario and wealth
 * definition. {@link RetirementPlan} rows are the *phases* within a journey
 * and point back via `independencePlanId`.
 *
 * The JSON-shaped fields (`phases`, `excludedPlanIds`, `excludedPortfolioIds`,
 * `liquidatedPortfolioIds`, `manualAssets`) arrive as serialised **strings**,
 * matching how `compositePhases` has always been handled on settings. Parse
 * with JSON.parse and guard against null/blank.
 */
export interface IndependencePlan {
  id: string
  ownerId: string
  name: string
  isPrimary: boolean
  displayCurrency?: string
  workScenarioId?: string
  /** JSON string[] of phase plan ids excluded from the composite. */
  excludedPlanIds?: string
  /** JSON {@link CompositePhase}[] — the composite timeline. */
  phases?: string
  /** JSON string[] of portfolio ids excluded from this journey's wealth. */
  excludedPortfolioIds?: string
  /** JSON string[] of portfolio ids sold at t0, proceeds seeding cash. */
  liquidatedPortfolioIds?: string
  /** Fraction, not percent — 0.05 is 5% of the liquidated value. */
  liquidationCostsPercent?: number
  /** JSON Record<string,number> of manual asset estimates by category. */
  manualAssets?: string
  /**
   * Journey-level assumptions (svc-retire#284). Every rate below is a decimal
   * **fraction**, not a percentage — 0.07 is 7%.
   *
   * Absent means the journey has never stated that rate, and each stage falls
   * back to its own column for it. There is no "clear" verb on the PATCH yet
   * (svc-retire#286), so absence is only ever the initial state.
   *
   * Asset allocation is NOT here: cash / equity / housing stay per stage.
   */
  cashReturnRate?: number
  equityReturnRate?: number
  housingReturnRate?: number
  inflationRate?: number
  feeRate?: number
  investmentTaxRate?: number
  /**
   * Journey-level target ending balance (svc-retire#282) — what the owner
   * wants left at the end of the journey. Denominated in the phase plans'
   * currency, same as every other monetary plan input, NOT the display
   * currency. Resolution rule: `journey.targetBalance ?? stage.targetBalance`
   * — when set, it overrides every stage's own `targetBalance` for that
   * journey. Absent means the journey has never stated one, and each stage
   * falls back to its own column.
   */
  targetBalance?: number
  createdDate: string
  updatedDate: string
  systemUserId?: string
}

/**
 * Create / update payload, shared by POST and PATCH. Every field is optional
 * here because PATCH is partial; `name` is required on create and svc-retire
 * enforces that, so a missing name comes back as a 400 rather than a
 * compile error.
 *
 * On PATCH, an **omitted** field is left alone and a blank string clears it.
 * Omit is the only way to say "leave this alone" — these fields do not admit
 * `null`, so don't send one expecting it to be ignored.
 *
 * `targetBalance` is the one exception to that last rule: it is typed
 * `number | null` because `null` on the wire explicitly clears the
 * journey-level target, distinct from omitting the field (which leaves the
 * stored target alone, same as every other field here). See its own
 * doc-comment below.
 */
export interface IndependencePlanRequest {
  name?: string
  displayCurrency?: string
  workScenarioId?: string
  excludedPlanIds?: string
  phases?: string
  excludedPortfolioIds?: string
  liquidatedPortfolioIds?: string
  liquidationCostsPercent?: number
  manualAssets?: string
  /**
   * Journey-level assumptions, as decimal **fractions** (0.07 = 7%). PATCH is
   * partial: send only the rates being changed. An omitted rate leaves the
   * stored one alone, so a single-field write is one key.
   */
  cashReturnRate?: number
  equityReturnRate?: number
  housingReturnRate?: number
  inflationRate?: number
  feeRate?: number
  investmentTaxRate?: number
  /**
   * Journey-level target ending balance (svc-retire#282). Three states, not
   * two: **omit** to leave the stored target alone (the rule every other
   * field on this interface follows); send an explicit **`null`** to clear
   * it back to unset; send a **number** to set it, where `0` is itself a
   * legitimate target (the journey's own box reads it as "none" — see
   * `journeyTargetBalance()` in planHelpers.ts for how the rest of the UI
   * treats a stored `0`). A negative number is rejected with a 400.
   */
  targetBalance?: number | null
}

export interface IndependencePlanResponse {
  data: IndependencePlan
}

export interface IndependencePlansResponse {
  data: IndependencePlan[]
}

/** Body for POST /independence-plans/{id}/duplicate — deep copy. */
export interface IndependencePlanCopyRequest {
  name: string
}
