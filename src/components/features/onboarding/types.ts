/**
 * Onboarding types for the conversational wizard.
 */

// Question flow states
export type QuestionType =
  | "welcome"
  | "currency"
  | "bank_account"
  | "bank_balance"
  | "add_another_account"
  | "pension_intro"
  | "pension_name"
  | "pension_balance"
  | "pension_return"
  | "pension_payout_age"
  | "pension_payout_amount"
  | "add_another_pension"
  | "complete"

// Bank account data
export interface BankAccountData {
  name: string
  currency: string
  balance?: number
}

// Pension plan data
export interface PensionData {
  name: string
  currency: string
  balance?: number
  expectedReturnRate?: number
  payoutAge?: number
  monthlyPayoutAmount?: number
}

// Other investment data
export interface OtherInvestmentData {
  name: string
  type: "MUTUAL_FUND" | "INVESTMENT_LINKED_INSURANCE"
  currency: string
  balance?: number
}

// Complete onboarding data collected
export interface OnboardingData {
  preferredName?: string
  baseCurrency: string
  bankAccounts: BankAccountData[]
  pensions: PensionData[]
  otherInvestments: OtherInvestmentData[]
}

// Question component props
export interface QuestionProps {
  onNext: () => void
  onSkip?: () => void
  onBack?: () => void
}
