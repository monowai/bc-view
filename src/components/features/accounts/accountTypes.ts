import { Asset } from "types/beancounter"

export interface SectorInfo {
  code: string
  name: string
  standard: string
}

export interface SectorOption {
  value: string
  label: string
}

// Categories that can be used for user-owned custom assets
export const USER_ASSET_CATEGORIES = ["ACCOUNT", "RE", "MUTUAL FUND", "POLICY"]

// Category icons mapping
export const CATEGORY_ICONS: Record<string, string> = {
  ACCOUNT: "fa-university",
  RE: "fa-home",
  "MUTUAL FUND": "fa-chart-pie",
  POLICY: "fa-piggy-bank",
}

export interface CategoryOption {
  value: string
  label: string
}

export interface EditAccountData {
  asset: Asset
}

export interface DeleteAccountData {
  asset: Asset
}

export interface SetPriceData {
  asset: Asset
}

export interface SetBalancesData {
  asset: Asset
}

export interface SetBalanceData {
  asset: Asset
}

export type TabType = "overview" | "all" | string
