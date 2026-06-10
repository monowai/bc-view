/**
 * Compile-time feature flags for the Independence plan UI.
 *
 * Toggles live here so a flip is one constant change + a rebuild — no
 * environment variable, settings table, or per-user override yet. Add
 * those layers only when a flag actually needs runtime control.
 */
export const independenceFeatureFlags = {
  /**
   * Surface the CPF MediSave Account (MA) sub-account as a row inside
   * the Retirement Fund expander on Assets-by-Category. Off by default:
   * MA is already accounted for under Non-Spendable → Healthcare
   * Reserve, and listing it inside the expander too means the same
   * S$58k shows on the screen twice.
   *
   * Flip back to true if we decide users need the per-sub-account
   * breakdown inside the expander (e.g. to surface MA's BHS headroom
   * alongside OA/SA/RA).
   */
  showCpfMaInRetirementExpander: false,
} as const

export type IndependenceFeatureFlags = typeof independenceFeatureFlags
