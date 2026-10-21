import type { ProjectionWarning } from "./projection"

// ============ Monte Carlo Simulation ============

export interface MonteCarloResponse {
  data: MonteCarloResult
}

export interface MonteCarloResult {
  planId: string
  iterations: number
  /** Success rate as percentage 0-100 */
  successRate: number
  terminalBalancePercentiles: PercentileValues
  yearlyBands: YearlyPercentileBand[]
  depletionAgeDistribution: DepletionAgeDistribution
  deterministicRunwayYears: number
  deterministicDepletionAge?: number
  currency: string
  parameters: MonteCarloParameters
  /** Median age at which illiquid assets were sold across iterations that liquidated */
  medianLiquidationAge?: number
  /** Starting value of illiquid (non-spendable) assets, in the result's currency */
  nonSpendableAtStart: number
  /** Number of iterations that sold illiquid assets during the run */
  liquidatedCount: number
  /** Data quality warnings - empty/absent means all data fetched successfully */
  warnings?: ProjectionWarning[]
}

export interface PercentileValues {
  p5: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
}

export interface YearlyPercentileBand {
  year: number
  age?: number
  p5: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
}

export interface DepletionAgeDistribution {
  depletedCount: number
  survivedCount: number
  earliestDepletionAge?: number
  mostCommonDepletionAge?: number
  percentiles?: PercentileValues
  histogram: Record<number, number>
  /** Per-iteration realized return summaries for depleted paths (capped at 50) */
  depletedPaths?: DepletedPathSummary[]
}

/** Summary of realized stochastic returns for a single depleted iteration */
export interface DepletedPathSummary {
  depletionAge: number
  /** Mean realized investment return p.a. up to depletion */
  averageReturn: number
  /** Worst single-year realized investment return */
  worstReturn: number
  /** Mean realized inflation p.a. up to depletion */
  averageInflation: number
  /** Highest single-year realized inflation */
  worstInflation: number
}

export interface MonteCarloParameters {
  blendedReturnRate: number
  blendedVolatility: number
  inflationRate: number
  inflationVolatility: number
  housingReturnRate: number
  housingVolatility: number
  equityVolatility: number
  cashVolatility: number
  equityCashCorrelation: number
  investmentTaxRate: number
}
