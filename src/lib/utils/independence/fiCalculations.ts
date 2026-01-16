/**
 * Shared Financial Independence (FIRE) calculation utilities.
 * Single source of truth for FI metrics calculations across components.
 */

/**
 * Calculate FI Progress percentage.
 * @param liquidAssets Current liquid (spendable) assets
 * @param fiNumber Target FI Number (25x annual expenses)
 * @returns Progress percentage (0-100+, can exceed 100 if FI achieved)
 */
export function calculateFiProgress(
  liquidAssets: number,
  fiNumber: number,
): number {
  if (fiNumber <= 0) return 100 // Already FI if no expenses
  return (liquidAssets / fiNumber) * 100
}

/**
 * Calculate Gap to FI (or surplus if negative).
 * @param fiNumber Target FI Number
 * @param liquidAssets Current liquid assets
 * @returns Positive = gap remaining, Negative = surplus (FI achieved)
 */
export function calculateGapToFi(
  fiNumber: number,
  liquidAssets: number,
): number {
  return fiNumber - liquidAssets
}

/**
 * Calculate FI Number using the 4% safe withdrawal rate (25x rule).
 * @param annualExpenses Annual expenses (net of income sources)
 * @returns FI Number
 */
export function calculateFiNumber(annualExpenses: number): number {
  return annualExpenses * 25
}

/**
 * Calculate FI Number from monthly expenses.
 * @param monthlyExpenses Monthly expenses (net of income sources)
 * @returns FI Number
 */
export function calculateFiNumberFromMonthly(monthlyExpenses: number): number {
  return calculateFiNumber(monthlyExpenses * 12)
}

/**
 * Check if financially independent.
 * @param fiProgress FI progress percentage
 * @returns true if FI Progress >= 100%
 */
export function isFinanciallyIndependent(fiProgress: number): boolean {
  return fiProgress >= 100
}

/**
 * Clamp FI Progress to 100% for display purposes (progress bars).
 * @param fiProgress Raw FI progress percentage
 * @returns Clamped progress (0-100)
 */
export function clampFiProgress(fiProgress: number): number {
  return Math.min(Math.max(fiProgress, 0), 100)
}

/**
 * Calculate Coast FI Number.
 * The amount needed now such that compound growth alone reaches FI by target date.
 * @param fiNumber Target FI Number
 * @param yearsToTarget Years until target (FI achievement or retirement)
 * @param expectedReturnRate Annual return rate (as decimal, e.g., 0.07 for 7%)
 * @returns Coast FI Number, or null if not calculable
 */
export function calculateCoastFiNumber(
  fiNumber: number,
  yearsToTarget: number,
  expectedReturnRate: number,
): number | null {
  if (yearsToTarget <= 0 || expectedReturnRate <= 0) return null
  return fiNumber / Math.pow(1 + expectedReturnRate, yearsToTarget)
}

/**
 * Calculate Coast FI Progress.
 * @param liquidAssets Current liquid assets
 * @param coastFiNumber Coast FI Number
 * @returns Progress percentage, or null if Coast FI not calculable
 */
export function calculateCoastFiProgress(
  liquidAssets: number,
  coastFiNumber: number | null,
): number | null {
  if (coastFiNumber === null || coastFiNumber <= 0) return null
  return (liquidAssets / coastFiNumber) * 100
}

/**
 * Check if Coast FIRE is achieved.
 * @param coastFiProgress Coast FI progress percentage
 * @returns true if Coast FI Progress >= 100%
 */
export function isCoastFireAchieved(coastFiProgress: number | null): boolean {
  return coastFiProgress !== null && coastFiProgress >= 100
}

/**
 * Calculate years to target age.
 * @param currentAge Current age
 * @param targetAge Target age (retirement or FI achievement)
 * @returns Years to target, or null if invalid inputs
 */
export function calculateYearsToTarget(
  currentAge: number | undefined,
  targetAge: number | undefined,
): number | null {
  if (
    currentAge === undefined ||
    targetAge === undefined ||
    targetAge <= currentAge
  ) {
    return null
  }
  return targetAge - currentAge
}

/**
 * Calculate savings rate.
 * @param monthlyInvestment Monthly investment amount
 * @param workingIncomeMonthly Monthly working income
 * @returns Savings rate as percentage, or null if income is zero
 */
export function calculateSavingsRate(
  monthlyInvestment: number,
  workingIncomeMonthly: number,
): number | null {
  if (workingIncomeMonthly <= 0 || monthlyInvestment <= 0) return null
  return (monthlyInvestment / workingIncomeMonthly) * 100
}

/**
 * Calculate blended return rate from allocation weights.
 * @param cashReturnRate Cash return rate (as decimal)
 * @param equityReturnRate Equity return rate (as decimal)
 * @param cashAllocation Cash allocation (as decimal, e.g., 0.2 for 20%)
 * @param equityAllocation Equity allocation (as decimal)
 * @returns Blended return rate (as decimal)
 */
export function calculateBlendedReturnRate(
  cashReturnRate: number,
  equityReturnRate: number,
  cashAllocation: number,
  equityAllocation: number,
): number {
  const investableTotal = cashAllocation + equityAllocation
  if (investableTotal <= 0) return 0

  const cashWeight = cashAllocation / investableTotal
  const equityWeight = equityAllocation / investableTotal

  return cashWeight * cashReturnRate + equityWeight * equityReturnRate
}

/**
 * Calculate real return rate (nominal minus inflation).
 * @param nominalRate Nominal return rate (as decimal)
 * @param inflationRate Inflation rate (as decimal)
 * @returns Real return rate (as decimal)
 */
export function calculateRealReturnRate(
  nominalRate: number,
  inflationRate: number,
): number {
  return nominalRate - inflationRate
}
