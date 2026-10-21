// ============ Private Asset Config ============

/**
 * Type of composite policy asset.
 */
export type PolicyType =
  "CPF" | "ILP" | "GENERIC" | "US_401K" | "US_IRA" | "UK_ISA"

/**
 * Tax treatment for a composite policy asset. Determines whether projected
 * withdrawals are taxed (TRADITIONAL), tax-free (ROTH / TAX_FREE), or net of
 * a configured withdrawal tax rate. US_401K/US_IRA default TRADITIONAL when
 * omitted; UK_ISA is always TAX_FREE.
 */
export type TaxTreatment = "TRADITIONAL" | "ROTH" | "TAX_FREE"

/**
 * Sub-account within a composite policy asset (e.g. CPF OA/SA/MA/RA, ILP funds).
 */
export interface SubAccount {
  id: string
  assetId: string
  code: string
  displayName?: string
  balance: number
  expectedReturnRate?: number
  feeRate?: number
  liquid: boolean
}

/**
 * Request to create or update a sub-account.
 */
export interface SubAccountRequest {
  code: string
  displayName?: string
  balance: number
  expectedReturnRate?: number
  feeRate?: number
  liquid?: boolean
}

/**
 * Configuration for private assets (Real Estate, etc.).
 * Stores income assumptions, expenses, and planning parameters.
 */
export interface PrivateAssetConfig {
  assetId: string
  // Income settings
  monthlyRentalIncome: number
  rentalCurrency: string
  // Country code for tax jurisdiction (ISO 3166-1 alpha-2, e.g., "NZ", "SG")
  countryCode: string
  // Expense settings - management
  monthlyManagementFee: number
  managementFeePercent: number
  // Expense settings - property costs
  monthlyBodyCorporateFee: number
  annualPropertyTax: number
  annualInsurance: number
  monthlyOtherExpenses: number
  // Tax settings - when true, deduct income tax using rate from user's country config
  deductIncomeTax: boolean
  // Planning settings
  isPrimaryResidence: boolean
  liquidationPriority: number
  // Transaction generation settings
  transactionDayOfMonth: number
  creditAccountId?: string
  autoGenerateTransactions: boolean
  // Pension/Policy payout settings
  expectedReturnRate?: number
  payoutAge?: number
  monthlyPayoutAmount?: number
  lumpSum?: boolean
  monthlyContribution?: number
  contributionFrequency?: "MONTHLY" | "ANNUAL"
  isPension: boolean
  // Composite policy support
  policyType?: PolicyType
  lockedUntilDate?: string
  subAccounts?: SubAccount[]
  // CPF LIFE settings
  cpfLifePlan?: "STANDARD" | "BASIC" | "ESCALATING"
  cpfPayoutStartAge?: number
  // US 401(k)/IRA + UK ISA wrapper settings. Decimals (e.g. 0.06 = 6%).
  // Omitted taxTreatment defaults to TRADITIONAL for US_401K/US_IRA and
  // TAX_FREE for UK_ISA.
  taxTreatment?: TaxTreatment
  employeeDeferralPercent?: number
  employerMatchPercent?: number
  employerMatchCapPercent?: number
  withdrawalTaxRate?: number
  // Timestamps
  createdDate: string
  updatedDate: string
}

export interface PrivateAssetConfigRequest {
  monthlyRentalIncome?: number
  rentalCurrency?: string
  countryCode?: string
  monthlyManagementFee?: number
  managementFeePercent?: number
  monthlyBodyCorporateFee?: number
  annualPropertyTax?: number
  annualInsurance?: number
  monthlyOtherExpenses?: number
  deductIncomeTax?: boolean
  isPrimaryResidence?: boolean
  liquidationPriority?: number
  transactionDayOfMonth?: number
  creditAccountId?: string
  autoGenerateTransactions?: boolean
  // Pension/Policy payout settings
  expectedReturnRate?: number
  payoutAge?: number
  monthlyPayoutAmount?: number
  lumpSum?: boolean
  monthlyContribution?: number
  contributionFrequency?: "MONTHLY" | "ANNUAL"
  isPension?: boolean
  // Composite policy support
  policyType?: PolicyType
  lockedUntilDate?: string
  subAccounts?: SubAccountRequest[]
  // CPF LIFE settings
  cpfLifePlan?: "STANDARD" | "BASIC" | "ESCALATING"
  cpfPayoutStartAge?: number
  // US 401(k)/IRA + UK ISA wrapper settings. Decimals (e.g. 0.06 = 6%).
  taxTreatment?: TaxTreatment
  employeeDeferralPercent?: number
  employerMatchPercent?: number
  employerMatchCapPercent?: number
  withdrawalTaxRate?: number
}

export interface PrivateAssetConfigResponse {
  data: PrivateAssetConfig
}

export interface PrivateAssetConfigsResponse {
  data: PrivateAssetConfig[]
  assetNames?: Record<string, string>
}

// ============ Tax Rates ============

/**
 * User-defined tax rate for a country.
 * Used to calculate income tax on rental properties.
 */
export interface TaxRate {
  countryCode: string
  rate: number // Decimal (e.g., 0.20 for 20%)
}

export interface TaxRateRequest {
  countryCode: string
  rate: number
}

export interface TaxRateResponse {
  data: TaxRate
}

export interface TaxRatesResponse {
  data: TaxRate[]
}
