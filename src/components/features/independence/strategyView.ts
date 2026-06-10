import type { PrimaryStrategy } from "types/independence"

/**
 * Session-only strategy view: which retirement-strategy lens the user wants
 * to inspect across the projection page. Lifted to the page so the
 * ScenarioBar headline gauge and the FiMetrics panel stay in sync.
 *
 * "ALL" forces every section visible at once. The three named values
 * (FIRE / PENSION / HYBRID) focus on a single strategy. There is no
 * separate "auto" option — the default seed is the plan's
 * `effectiveStrategy`, so the dropdown opens on the auto-detected pick.
 */
export type StrategyView = PrimaryStrategy | "ALL"

export const STRATEGY_VIEW_LABELS: Record<StrategyView, string> = {
  FIRE: "FIRE",
  PENSION: "Pension",
  HYBRID: "Self-funded",
  ALL: "All",
}

/**
 * Picks the initial dropdown value from the plan's effective strategy.
 * Falls back to FIRE when no strategy has been resolved yet.
 */
export function defaultStrategyView(
  effectiveStrategy: PrimaryStrategy | undefined,
): StrategyView {
  return effectiveStrategy ?? "FIRE"
}
