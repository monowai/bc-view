import type { Currency, CurrencyOption } from "./asset"
import type { Total } from "./holdings"
import type { SystemUser } from "./user"

export interface Portfolio {
  id: string
  code: string
  name: string
  active?: boolean // Defaults to true if not specified
  currency: Currency
  base: Currency
  owner?: SystemUser
  marketValue: number
  irr: number
  gainOnDay?: number
  assetClassification?: Record<string, number>
  valuedAt?: string // ISO date string (YYYY-MM-DD) - market data date
  lastUpdated?: string // ISO timestamp - when system updated the values
  // Funding portfolio for cash auto-settle. Overrides owner.cashPortfolioId.
  // undefined (or absent) disables auto-settle for this portfolio.
  cashPortfolioId?: string
}

export interface PortfolioResponse {
  data: Portfolio
}

export interface PortfolioResponses {
  data: Portfolio[]
}

export interface PortfolioRequest {
  code: string
  name: string
  currency: string
  base: string
  active?: boolean
  cashPortfolioId?: string
}

export interface PortfolioRequests {
  data: PortfolioRequest[]
}

export interface PortfolioSummary {
  totals: Total
  currency: Currency
}

export interface PortfolioInput {
  code: string
  name: string
  currency: CurrencyOption
  base: CurrencyOption
  active?: boolean
  cashPortfolioId?: string
}
