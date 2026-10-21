// ============ User Independence Settings ============
export interface UserIndependenceSettings {
  id: string
  ownerId: string
  yearOfBirth?: number
  monthOfBirth?: number
  targetIndependenceAge?: number
  lifeExpectancy: number
  compositeDisplayCurrency?: string
  compositePhases?: string
  compositeExcludedPlanIds?: string
  compositeWorkScenarioId?: string
  /**
   * JSON-serialised string[] of portfolio IDs to exclude from wealth
   * and FI calculations. e.g. '["pf-id-1","pf-id-2"]'.
   * Parse with JSON.parse; guard against null/blank.
   */
  excludedPortfolioIds?: string | null
  /**
   * JSON-serialised Record<string,number> of manual asset estimates
   * (category → value) used when the user has no portfolio balances.
   * e.g. '{"CASH":1000,"EQUITY":5000,"RE":200000}'.
   * Parse with JSON.parse; guard against null/blank.
   */
  manualAssets?: string | null
  createdDate: string
  updatedDate: string
}

export interface UpdateSettingsRequest {
  yearOfBirth?: number
  monthOfBirth?: number
  lifeExpectancy?: number
  targetIndependenceAge?: number
  compositeDisplayCurrency?: string
  compositePhases?: string
  compositeExcludedPlanIds?: string
  compositeWorkScenarioId?: string
  /**
   * JSON-serialised string[] of portfolio IDs to exclude from wealth
   * and FI calculations. e.g. '["pf-id-1","pf-id-2"]'.
   */
  excludedPortfolioIds?: string | null
  /**
   * JSON-serialised Record<string,number> of manual asset estimates
   * (category → value). e.g. '{"CASH":1000,"EQUITY":5000,"RE":200000}'.
   */
  manualAssets?: string | null
}
