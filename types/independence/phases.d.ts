// ============ Phased Plans Types ============
export interface SpendBucket {
  name: string
  baseFraction: number
  phaseMultipliers: number[]
}

export interface SpendPhase {
  key: string
  label: string
  horizonWeight?: number
}

export interface GeneratedPhase {
  planId: string
  key: string
  label: string
  fromAge: number
  toAge: number
  monthlyExpenses: number
}

export interface GeneratePhasesResponse {
  basePlanId: string
  phases: GeneratedPhase[]
  compositePhases: string
}

export interface GeneratePhasesRequest {
  force?: boolean
  phases?: SpendPhase[]
  buckets?: SpendBucket[]
}
