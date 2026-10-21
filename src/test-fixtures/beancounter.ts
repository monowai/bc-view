/**
 * Shared test fixtures for Beancounter domain types.
 *
 * Each builder accepts a `Partial<T>` overrides argument and returns a fully-formed
 * object matching the type's required fields. Use these in tests instead of hand-rolling
 * Position/Portfolio/Holdings shapes — keeps fixtures consistent as types evolve.
 *
 * Builders live in per-domain files beside this barrel; import from here or
 * from the domain file directly.
 *
 * Example:
 *   const position = makePosition({ asset: makeAsset({ code: "MSFT" }) })
 *   const holdings = makeHoldings({ holdingGroups: { Equity: makeHoldingGroup([position]) } })
 */
export * from "./asset"
export * from "./holdings"
export * from "./portfolio"
export * from "./trn"
export * from "./user"
export * from "./watchlist"
