// ============ Category Labels ============
export interface CategoryLabel {
  id: string
  ownerId: string
  name: string
  description?: string
  sortOrder: number
}

export interface CategoryLabelRequest {
  name: string
  description?: string
  sortOrder?: number
}

export interface CategoryLabelsResponse {
  data: CategoryLabel[]
}

// ============ Lifestyle Mood Board ============
export interface LifestyleTier {
  label: string
  emoji: string
  monthlyAmount: number
  description: string
  reserve: boolean
}

export interface LifestyleCategory {
  key: string
  displayName: string
  emoji: string
  categoryLabelId: string
  sortOrder: number
  tiers: LifestyleTier[]
}

export interface LifestyleCatalogResponse {
  householdSize: number
  currency: string
  categories: LifestyleCategory[]
}

/**
 * Emitted by LifestyleMoodBoard whenever the tier selection changes (slider
 * fit or a direct tier click). `selection` maps catalog category `key` ->
 * chosen tier index. `pickedKeys` are the categories the user has
 * explicitly set via the board (as opposed to ones still only reflecting
 * the pre-existing expense's nearest-tier match) — used to gate custom-
 * amount detection.
 */
export interface TierSelectionChange {
  selection: Record<string, number>
  pickedKeys: string[]
}
