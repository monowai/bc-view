/**
 * Single source of truth for tooltip copy shared across independence gauges.
 *
 * The "Retirement-Age Progress" gauge (key: "retirement-age-fi") is rendered in
 * both StrategyGaugesStrip and FiMetrics; keep its wording unified here so the
 * two surfaces never diverge.
 */
export const RETIREMENT_PROGRESS_TOOLTIP =
  "Adds the present value of your guaranteed pension income (discounted to today) to your liquid pot, compared against your FI Number."

export const RETIREMENT_PROGRESS_OFFTRACK_TOOLTIP =
  "This % uses the 4% rule, which this plan's returns don't meet — see Plan Insights for what it takes. It adds the present value of your guaranteed pension income (discounted to today) to your liquid pot before comparing against the FI Number."
