// Asset Allocation types
export interface CategoryAllocation {
  category: string
  marketValue: number
  percentage: number
}

export interface AllocationData {
  cashAllocation: number
  equityAllocation: number
  housingAllocation: number
  totalValue: number
  currency: string
  categoryBreakdown: Record<string, CategoryAllocation>
}

export interface AllocationResponse {
  data: AllocationData
}

// Classification types for sector/industry grouping
export interface AssetClassificationSummary {
  assetId: string
  sector?: string
  industry?: string
}

export interface BulkClassificationRequest {
  assetIds: string[]
}

export interface BulkClassificationResponse {
  data: Record<string, AssetClassificationSummary>
}

// ETF Sector Exposure types
export interface SectorExposure {
  item: {
    name: string
    code: string
  }
  weight: number
  asOf: string
}

export interface SectorExposuresResponse {
  data: SectorExposure[]
}

// ETF Top Holdings types
export interface AssetHolding {
  symbol: string
  name?: string
  weight: number
  asOf: string
}

export interface AssetHoldingsResponse {
  data: AssetHolding[]
}
