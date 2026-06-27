import React, { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/router"
import useSwr from "swr"
import { useUser } from "@auth0/nextjs-auth0/client"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import {
  Currency,
  PolicyType,
  Portfolio,
  SubAccountRequest,
} from "types/beancounter"
import OnboardingProgress from "./OnboardingProgress"
import WelcomeStep from "./steps/WelcomeStep"
import CurrencyStep from "./steps/CurrencyStep"
import AssetsStep from "./steps/AssetsStep"
import ReviewStep from "./steps/ReviewStep"
import CompleteStep from "./steps/CompleteStep"
import IndependencePlanStep from "./steps/IndependencePlanStep"
import BrokerageStep from "./steps/BrokerageStep"
import { type PortfolioMode } from "@components/features/openBrokerage/PortfolioModeChooser"
import { openBrokerage } from "@lib/openBrokerage/orchestrate"
import { buildBrokerageFunding } from "@lib/openBrokerage/buildBrokerageFunding"
import { deriveBrokerCode } from "@lib/openBrokerage/brokerCode"
import { useRegistration } from "@contexts/RegistrationContext"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import Spinner from "@components/ui/Spinner"
import { buildMePatchBody } from "./buildMePatchBody"
import { buildPensionTrn } from "./buildPensionTrn"

export interface BankAccount {
  name: string
  currency: string
  balance?: number
}

export interface Property {
  name: string
  price: number
  value?: number
  purchaseDate?: string // ISO date string for when the property was purchased
}

export interface Pension {
  name: string
  currency: string
  balance?: number
  expectedReturnRate?: number
  payoutAge?: number
  monthlyPayoutAmount?: number
  lumpSum?: boolean // If true, pays out in full rather than monthly
  monthlyContribution?: number // Regular contribution amount
  policyType?: PolicyType // Composite policy type (CPF, ILP, GENERIC)
  cpfLifePlan?: "STANDARD" | "BASIC" | "ESCALATING" // CPF LIFE payout plan
  lockedUntilDate?: string // Date when asset can be liquidated
  subAccounts?: SubAccountRequest[] // Sub-accounts for composite policies
}

export interface Insurance {
  name: string
  currency: string
  currentValue?: number
  expectedReturnRate?: number
  payoutAge?: number
  payoutAmount?: number
  lumpSum?: boolean // Life insurance typically pays out in full
  monthlyContribution?: number // Premium/contribution amount
}

export interface OnboardingState {
  baseCurrency: string
  reportingCurrency: string
  portfolioName: string
  bankAccounts: BankAccount[]
  properties: Property[]
  pensions: Pension[]
  insurances: Insurance[]
}

/**
 * Build a short asset code from a user-typed name. Splits on any
 * non-alphanumeric (whitespace, hyphens, dots, underscores) so that
 * names like "DBS-SGD" and "DBS-USD" produce distinct codes
 * ("DBS-SGD" / "DBS-USD") instead of colliding on a truncated prefix
 * ("DBS-" each). Caps at 16 chars to stay within DB column bounds and
 * to avoid hand-typed paragraphs becoming the code.
 */
function generateAssetCode(name: string): string {
  const upper = name.trim().toUpperCase()
  if (!upper) return "ASSET"
  const parts = upper.split(/[^A-Z0-9]+/).filter(Boolean)
  if (parts.length === 0) return "ASSET"
  // Preserve hyphenation so user-typed identifiers stay distinct.
  // Single-token names still get the original short-prefix behaviour
  // (e.g. "Savings" → "SAVINGS"), capped to 16 chars.
  return parts.join("-").slice(0, 16)
}

const OnboardingWizard: React.FC = () => {
  const router = useRouter()
  const { markOnboardingComplete } = useRegistration()
  const { user } = useUser()
  const { preferences } = useUserPreferences()

  // Fetch currencies from backend
  const { data: ccyResponse } = useSwr(ccyKey, simpleFetcher(ccyKey))
  const currencies: Currency[] = ccyResponse?.data || []

  // Fetch portfolios for the Brokerage step's source-portfolio dropdown
  const { data: portfoliosResponse } = useSwr<{ data: Portfolio[] }>(
    "/api/portfolios",
    simpleFetcher("/api/portfolios"),
  )
  const existingPortfolios: Portfolio[] = portfoliosResponse?.data ?? []

  // Wizard state - no pre-selection, user must explicitly choose
  const [currentStep, setCurrentStep] = useState(1)
  const [preferredName, setPreferredName] = useState("")
  // Default to SGD; the preferences effect below overrides with any saved
  // currency preference for returning users.
  const [baseCurrency, setBaseCurrency] = useState("SGD")
  const [reportingCurrency, setReportingCurrency] = useState("SGD")
  const [prefsInitialized, setPrefsInitialized] = useState(false)
  const [portfolioCode, setPortfolioCode] = useState("")
  const [portfolioName, setPortfolioName] = useState("")
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [pensions, setPensions] = useState<Pension[]>([])
  const [insurances, setInsurances] = useState<Insurance[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPortfolioId, setCreatedPortfolioId] = useState<string | null>(
    null,
  )

  // Independence plan state
  const currentYear = new Date().getFullYear()
  const [independencePlanEnabled, setIndependencePlanEnabled] = useState(true)
  const [independenceYearOfBirth, setIndependenceYearOfBirth] = useState(
    currentYear - 55,
  )
  const [independenceMonthOfBirth, setIndependenceMonthOfBirth] = useState(1)
  const [independenceMonthlyExpenses, setIndependenceMonthlyExpenses] =
    useState(0)
  const [independenceTargetAge, setIndependenceTargetAge] = useState(65)
  const [independencePlanCreated, setIndependencePlanCreated] = useState(false)

  // Work plan state (collected in the Independence step)
  const [workingIncomeMonthly, setWorkingIncomeMonthly] = useState(0)
  const [workingExpensesMonthly, setWorkingExpensesMonthly] = useState(0)
  const [taxesMonthly, setTaxesMonthly] = useState(0)
  const [bonusMonthly, setBonusMonthly] = useState(0)
  const [investmentAllocationPercent, setInvestmentAllocationPercent] =
    useState(80)

  // Brokerage step (optional, post-default-portfolio creation)
  const [brokerageEnabled, setBrokerageEnabled] = useState(false)
  const [brokerageBrokerName, setBrokerageBrokerName] = useState("")
  // Currencies the user expects to trade — one per-broker cash account + default
  // settlement mapping is opened for each. Opening balances are recorded later.
  const [brokerageCurrencies, setBrokerageCurrencies] = useState<string[]>([])
  // Zen vs Master for the brokerage. Default to Zen — attach to the default
  // portfolio created during onboarding (the single-pot path). Master gives
  // the brokerage its own dedicated portfolio.
  const [brokeragePortfolioMode, setBrokeragePortfolioMode] =
    useState<PortfolioMode>("existing")
  const [brokerageCreated, setBrokerageCreated] = useState(false)

  // Pre-fill fields from user preferences or Auth0 profile (render-phase
  // one-time init — guarded so it runs once when preferences first arrive).
  if (!prefsInitialized && preferences) {
    // Pre-fill name
    const existingName =
      preferences.preferredName ||
      (user?.nickname as string) ||
      (user?.name as string) ||
      ""
    if (existingName) {
      setPreferredName(existingName)
    }

    // Pre-fill currencies
    if (preferences.baseCurrencyCode) {
      setBaseCurrency(preferences.baseCurrencyCode)
    }
    if (preferences.reportingCurrencyCode) {
      setReportingCurrency(preferences.reportingCurrencyCode)
    }

    // Pre-fill date of birth so a known DOB wins over the currentYear-55
    // default (otherwise everyone defaulted to ~55 years old).
    if (preferences.yearOfBirth) {
      setIndependenceYearOfBirth(preferences.yearOfBirth)
    }
    if (preferences.monthOfBirth) {
      setIndependenceMonthOfBirth(preferences.monthOfBirth)
    }

    setPrefsInitialized(true)
  }

  // Steps configuration
  const steps = useMemo(
    () => [
      { id: 1, label: "Welcome" },
      { id: 2, label: "Currency" },
      { id: 3, label: "Assets" },
      { id: 4, label: "Review" },
      { id: 5, label: "Independence" },
      { id: 6, label: "Brokerage" },
      { id: 7, label: "Complete" },
    ],
    [],
  )

  // Remove handlers for Review step
  const handleRemoveBankAccount = (index: number): void => {
    setBankAccounts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRemoveProperty = (index: number): void => {
    setProperties((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRemovePension = (index: number): void => {
    setPensions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRemoveInsurance = (index: number): void => {
    setInsurances((prev) => prev.filter((_, i) => i !== index))
  }

  // A CPF pension makes date of birth mandatory — CPF contribution rates are
  // age-banded, so the payslip / DC calc is broken without a real birth year.
  const hasCpfPension = useMemo(
    () => pensions.some((p) => p.policyType === "CPF"),
    [pensions],
  )
  const cpfDobValid =
    independenceYearOfBirth >= 1920 &&
    independenceYearOfBirth <= currentYear - 16

  // Validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return true // Welcome - always can proceed
      case 2:
        return baseCurrency !== ""
      case 3:
        return true // Assets are optional
      case 4:
        return true // Review - always can proceed
      case 5:
        // Independence is optional, BUT if a CPF pension was added the date of
        // birth must be valid (age-banded CPF rates).
        return !hasCpfPension || cpfDobValid
      case 6:
        return true // Brokerage - always can proceed (optional step)
      case 7:
        return true // Complete
      default:
        return false
    }
  }, [currentStep, baseCurrency, hasCpfPension, cpfDobValid])

  const handleNext = (): void => {
    if (currentStep < steps.length && canProceed) {
      // Auto-create the portfolio from the base currency when leaving the
      // currency step (the dedicated portfolio step was removed).
      if (currentStep === 2 && baseCurrency) {
        setPortfolioCode(baseCurrency)
        setPortfolioName(`${baseCurrency} Portfolio`)
      }
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = (): void => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = useCallback(() => {
    // Skip moves to the next step
    if (currentStep === 2) {
      // Skipping currency - default to SGD and auto-create the portfolio.
      const currency = baseCurrency || "SGD"
      setBaseCurrency(currency)
      setReportingCurrency(currency)
      setPortfolioCode(currency)
      setPortfolioName(`${currency} Portfolio`)
      setCurrentStep(3) // Move to assets
      return
    }
    if (currentStep === 3) {
      // Skipping assets step - go to review
      setCurrentStep(4)
      return
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep, steps.length, baseCurrency])

  // Create a transaction via HTTP API
  const createTransaction = async (
    portfolioId: string,
    assetId: string,
    trnType: string,
    quantity: number,
    price: number,
    tradeCurrency: string,
    tradeDate: string,
    cashCurrency?: string,
    cashAssetId?: string,
  ): Promise<void> => {
    const requestBody = {
      portfolioId: portfolioId,
      data: [
        {
          assetId: assetId,
          trnType: trnType,
          quantity: quantity,
          price: price,
          tradeCurrency: tradeCurrency,
          tradeDate: tradeDate,
          status: "SETTLED",
          ...(cashCurrency && { cashCurrency }),
          ...(cashAssetId && { cashAssetId }),
        },
      ],
    }

    console.log("Creating transaction:", JSON.stringify(requestBody, null, 2))

    const response = await fetch("/api/trns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage =
        errorData.error || `Failed to create ${trnType} transaction`
      throw new Error(errorMessage)
    }
  }

  // Helper to extract asset from response (data is Record<string, Asset>)
  const extractAsset = (
    assetData: { data: Record<string, { id: string }> } | undefined,
  ): { id: string } | null => {
    if (!assetData?.data) return null
    const assets = Object.values(assetData.data)
    return assets.length > 0 ? assets[0] : null
  }

  // Find an existing asset by code, or create a new one
  const findOrCreateAsset = async (
    assetCode: string,
    existingAssets: Record<string, { id: string }>,
    assetPayload: Record<string, unknown>,
  ): Promise<{ id: string } | null> => {
    // Check if asset already exists
    const existing = existingAssets[assetCode]
    if (existing) {
      console.log(`Asset ${assetCode} already exists: id=${existing.id}`)
      return existing
    }

    const assetResponse = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { [assetCode]: assetPayload } }),
    })

    if (!assetResponse.ok) return null
    const assetData = await assetResponse.json()
    return extractAsset(assetData)
  }

  const createAssets = async (
    portfolioId: string,
  ): Promise<{ bankAccountAssetIds: Record<string, string> }> => {
    const bankAccountAssetIds: Record<string, string> = {}
    // Fetch existing user assets to avoid creating duplicates
    const existingResponse = await fetch("/api/assets")
    const existingAssets: Record<string, { id: string }> = existingResponse.ok
      ? (
          (await existingResponse.json()) as {
            data: Record<string, { id: string }>
          }
        ).data || {}
      : {}

    // Create bank accounts
    for (const account of bankAccounts) {
      const assetCode = generateAssetCode(account.name)
      const asset = await findOrCreateAsset(assetCode, existingAssets, {
        market: "PRIVATE",
        code: assetCode,
        name: account.name,
        category: "ACCOUNT",
        currency: account.currency,
      })

      if (asset?.id) {
        bankAccountAssetIds[account.name] = asset.id
      }

      if (asset?.id && account.balance && account.balance > 0) {
        await createTransaction(
          portfolioId,
          asset.id,
          "DEPOSIT",
          account.balance,
          1,
          account.currency,
          new Date().toISOString().split("T")[0],
          account.currency,
          asset.id,
        )
      }
    }

    // Create properties
    for (const property of properties) {
      const assetCode = generateAssetCode(property.name)
      const currentValue = property.value || property.price
      const tradeDate =
        property.purchaseDate || new Date().toISOString().split("T")[0]

      const asset = await findOrCreateAsset(assetCode, existingAssets, {
        market: "PRIVATE",
        code: assetCode,
        name: property.name,
        category: "RE",
        currency: baseCurrency,
      })

      if (asset?.id && property.price > 0) {
        await createTransaction(
          portfolioId,
          asset.id,
          "ADD",
          1,
          property.price,
          baseCurrency,
          tradeDate,
        )

        // Set current market value as a price for the asset if different from purchase price
        if (currentValue !== property.price) {
          await fetch("/api/prices/write", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: asset.id,
              date: new Date().toISOString().split("T")[0],
              closePrice: currentValue,
            }),
          })
        }
      }
    }

    // Create pensions
    for (const pension of pensions) {
      const assetCode = generateAssetCode(pension.name)
      const asset = await findOrCreateAsset(assetCode, existingAssets, {
        market: "PRIVATE",
        code: assetCode,
        name: pension.name,
        category: "POLICY",
        currency: pension.currency,
      })

      if (asset?.id) {
        // Always create PrivateAssetConfig for pension assets with isPension: true
        await fetch(`/api/assets/config/${asset.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isPension: true,
            expectedReturnRate: pension.expectedReturnRate,
            payoutAge: pension.payoutAge,
            monthlyPayoutAmount: pension.lumpSum
              ? undefined
              : pension.monthlyPayoutAmount,
            lumpSum: pension.lumpSum,
            monthlyContribution: pension.monthlyContribution,
            rentalCurrency: pension.currency,
            policyType: pension.policyType,
            cpfLifePlan: pension.cpfLifePlan,
            lockedUntilDate: pension.lockedUntilDate || null,
            subAccounts: pension.subAccounts,
          }),
        })

        // Link the pension to the default portfolio so a freshly
        // onboarded user never sees the "isn't in a portfolio yet"
        // banner. Composite pensions (CPF) carry their balance in
        // sub-accounts, so post a BALANCE trn with the per-sub-account
        // map exactly as LinkCompositeDialog does; plain pensions keep
        // the cash-neutral ADD. Both are skipped when there's nothing
        // to link. See buildPensionTrn for the shape.
        const trnRow = buildPensionTrn(
          pension,
          asset.id,
          new Date().toISOString().split("T")[0],
        )
        if (trnRow) {
          const response = await fetch("/api/trns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ portfolioId, data: [trnRow] }),
          })
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(
              errorData.error || `Failed to link ${pension.name} to portfolio`,
            )
          }
        }
      }
    }

    // Create life insurance policies
    for (const insurance of insurances) {
      const assetCode = generateAssetCode(insurance.name)
      const asset = await findOrCreateAsset(assetCode, existingAssets, {
        market: "PRIVATE",
        code: assetCode,
        name: insurance.name,
        category: "POLICY",
        currency: insurance.currency,
      })

      if (asset?.id) {
        // Create PrivateAssetConfig for insurance settings
        await fetch(`/api/assets/config/${asset.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isPension: true, // Insurance policies are tracked like pensions
            expectedReturnRate: insurance.expectedReturnRate,
            payoutAge: insurance.payoutAge,
            monthlyPayoutAmount: insurance.lumpSum
              ? undefined
              : insurance.payoutAmount,
            lumpSum: insurance.lumpSum !== false, // Default to true for insurance
            monthlyContribution: insurance.monthlyContribution,
            rentalCurrency: insurance.currency,
          }),
        })

        // Create ADD transaction - use current value if provided, otherwise default to 1
        const quantity =
          insurance.currentValue && insurance.currentValue > 0
            ? insurance.currentValue
            : 1
        await createTransaction(
          portfolioId,
          asset.id,
          "ADD",
          quantity,
          1,
          insurance.currency,
          new Date().toISOString().split("T")[0],
        )

        // Set constant price of 1 for insurance assets
        await fetch("/api/prices/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: asset.id,
            date: new Date().toISOString().split("T")[0],
            closePrice: 1,
          }),
        })
      }
    }

    return { bankAccountAssetIds }
  }

  const handleComplete = async (): Promise<void> => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Save user preferences with currency settings. When the user filled
      // in the independence step, also persist their date of birth AND
      // target independence age on the SystemUser preferences (svc-data)
      // so age-driven projections don't fall back to the currentYear-55
      // / target-65 defaults. svc-retire's UserIndependenceSettings reads
      // these as its fallback when its own row has null demographic
      // fields — see bc-claude/USER_PROFILE.md.
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildMePatchBody({
            preferredName,
            baseCurrency,
            reportingCurrency,
            independencePlanEnabled,
            cpfRequiresDob: hasCpfPension,
            independenceYearOfBirth,
            independenceMonthOfBirth,
            independenceTargetAge,
          }),
        ),
      })

      // Create portfolio with reporting currency as display currency
      // and base currency as cost tracking currency. Make the call
      // idempotent so a retry after a downstream failure (e.g. the
      // optional Brokerage step erroring out) doesn't trip the
      // (code, owner_id) unique constraint and 409 — reuse the
      // existing portfolio with the same code instead.
      const existingPortfolio = existingPortfolios.find(
        (p) => p.code === portfolioCode,
      )
      let portfolioId: string | undefined = existingPortfolio?.id
      if (!portfolioId) {
        const portfolioResponse = await fetch("/api/portfolios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [
              {
                code: portfolioCode,
                name: portfolioName,
                currency: reportingCurrency,
                base: baseCurrency,
              },
            ],
          }),
        })

        if (!portfolioResponse.ok) {
          const errorData = await portfolioResponse.json().catch(() => ({}))
          setError(errorData.error || "Failed to create portfolio")
          setIsSubmitting(false)
          return
        }

        const portfolioData = await portfolioResponse.json()
        portfolioId = portfolioData.data[0]?.id
      }
      setCreatedPortfolioId(portfolioId ?? null)

      // Create assets if any (bank accounts, properties, pensions, insurances).
      if (
        portfolioId &&
        (bankAccounts.length > 0 ||
          properties.length > 0 ||
          pensions.length > 0 ||
          insurances.length > 0)
      ) {
        await createAssets(portfolioId)
      }

      // Trigger portfolio valuation by fetching holdings
      const today = new Date().toISOString().split("T")[0]
      const holdingsResponse = await fetch(
        `/api/holdings/${portfolioCode}?asAt=${today}`,
        { credentials: "include" },
      )
      if (!holdingsResponse.ok) {
        console.warn(
          "Failed to trigger portfolio valuation:",
          holdingsResponse.status,
        )
      }

      // Create independence plan if enabled
      if (independencePlanEnabled) {
        try {
          // Create a work scenario with user-provided income/expense data
          await fetch("/api/independence/work-scenarios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Working Situation",
              currency: baseCurrency,
              workingIncomeMonthly,
              workingExpensesMonthly,
              taxesMonthly,
              bonusMonthly,
              investmentAllocationPercent: investmentAllocationPercent / 100,
            }),
          })
        } catch (scenarioErr) {
          console.warn("Work scenario creation failed:", scenarioErr)
        }

        try {
          const planResponse = await fetch("/api/independence/plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "My Independence Plan",
              yearOfBirth: independenceYearOfBirth,
              planningHorizonYears: 90 - independenceTargetAge,
              lifeExpectancy: 90,
              monthlyExpenses: independenceMonthlyExpenses,
              expensesCurrency: baseCurrency,
              cashReturnRate: 0.03,
              equityReturnRate: 0.08,
              housingReturnRate: 0.04,
              inflationRate: 0.025,
              cashAllocation: 0.2,
              equityAllocation: 0.8,
              housingAllocation: 0.0,
              pensionMonthly: 0,
              socialSecurityMonthly: 0,
              otherIncomeMonthly: 0,
              workingIncomeMonthly: 0,
              workingExpensesMonthly: 0,
              taxesMonthly: 0,
              bonusMonthly: 0,
              investmentAllocationPercent: 0.8,
            }),
          })
          if (planResponse.ok) {
            setIndependencePlanCreated(true)
          } else {
            console.warn("Failed to create independence plan")
          }
        } catch (planErr) {
          console.warn("Independence plan creation failed:", planErr)
        }
      }

      // Optional: open a brokerage as part of the onboarding flow. Runs
      // AFTER the default portfolio is created so the user can fund the new
      // broker cash from it. Failures are surfaced but don't abort the
      // wizard — the user can retry from /tools/open-brokerage.
      // Use the local `portfolioId` variable (set just above), not the
      // React state `createdPortfolioId` — setState hasn't flushed inside
      // the same async function call.
      // Zen Mode attaches the brokerage to the default portfolio just created
      // above; Master Mode gives it a new dedicated portfolio.
      const isZen = brokeragePortfolioMode === "existing"
      // Currencies the user expects to trade — fall back to base currency so a
      // broker is never registered with zero settlement accounts.
      const brokerageCcys =
        brokerageCurrencies.length > 0 ? brokerageCurrencies : [baseCurrency]
      if (brokerageEnabled && brokerageBrokerName.trim() && portfolioId) {
        try {
          // Brokerage gets its own dedicated portfolio (named after the
          // broker) so its cash + future trades stay separate from the
          // user's day-to-day bank-account portfolio.
          const brokerName = brokerageBrokerName.trim()
          // Abbreviated code (Interactive Brokers → IB) for the portfolio
          // code; the display name keeps the full broker name.
          const brokerCode = deriveBrokerCode(brokerName)
          // First picked currency is the dedicated portfolio's reporting
          // currency; the portfolio still holds every selected currency's cash
          // line. `base` stays the user's overall base for consolidated
          // reporting upstream.
          const brokerageCcy = brokerageCcys[0] || baseCurrency
          // Portfolio code used for the brokerage — Zen reuses the default
          // portfolio's code, Master coins a new one from the broker. Drives
          // both the openBrokerage payload and the post-create valuation fetch
          // below so the two can't drift.
          const usedPortfolioCode = isZen ? portfolioCode : brokerCode
          const brokerageResult = await openBrokerage({
            broker: { mode: "new", newName: brokerName },
            portfolio: isZen
              ? {
                  mode: "existing",
                  existingId: portfolioId,
                  code: usedPortfolioCode,
                  currency: brokerageCcy,
                }
              : {
                  mode: "new",
                  code: usedPortfolioCode,
                  name: `${brokerName} Portfolio`,
                  currency: brokerageCcy,
                  base: baseCurrency,
                },
            // Open one broker cash account (e.g. IB-USD) per selected currency
            // so its settlement mapping exists — Zen or Master. Opening balances
            // are recorded later, so every row is amount 0 (no trn posted).
            funding: buildBrokerageFunding(brokerageCcys),
          })
          setBrokerageCreated(true)
          // Trigger valuation for the new brokerage portfolio (same as we
          // do for the default portfolio earlier); otherwise the home /
          // portfolios list shows it with no market value until the user
          // opens it.
          try {
            const valuationCode = usedPortfolioCode
            await fetch(`/api/holdings/${valuationCode}?asAt=${today}`, {
              credentials: "include",
            })
          } catch (vErr) {
            console.warn(
              "Failed to trigger brokerage portfolio valuation:",
              vErr,
            )
          }
          // Touch result so eslint sees it as used; future caller may want
          // the broker / portfolio ids for navigation.
          void brokerageResult
        } catch (bErr) {
          console.warn("Onboarding brokerage setup failed:", bErr)
          setError(
            `Brokerage setup failed: ${bErr instanceof Error ? bErr.message : String(bErr)}. The rest of your setup was saved.`,
          )
        }
      }

      // Move to complete step
      setCurrentStep(7)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinish = (): void => {
    markOnboardingComplete()
    router.push("/")
  }

  const renderStep = (): React.ReactNode => {
    switch (currentStep) {
      case 1:
        return (
          <WelcomeStep
            preferredName={preferredName}
            onPreferredNameChange={setPreferredName}
          />
        )
      case 2:
        return (
          <CurrencyStep
            currencies={currencies}
            baseCurrency={baseCurrency}
            reportingCurrency={reportingCurrency}
            onBaseCurrencyChange={setBaseCurrency}
            onReportingCurrencyChange={setReportingCurrency}
          />
        )
      case 3:
        return (
          <AssetsStep
            baseCurrency={baseCurrency}
            bankAccounts={bankAccounts}
            properties={properties}
            pensions={pensions}
            insurances={insurances}
            onBankAccountsChange={setBankAccounts}
            onPropertiesChange={setProperties}
            onPensionsChange={setPensions}
            onInsurancesChange={setInsurances}
          />
        )
      case 4:
        return (
          <ReviewStep
            baseCurrency={baseCurrency}
            bankAccounts={bankAccounts}
            properties={properties}
            pensions={pensions}
            insurances={insurances}
            onRemoveBankAccount={handleRemoveBankAccount}
            onRemoveProperty={handleRemoveProperty}
            onRemovePension={handleRemovePension}
            onRemoveInsurance={handleRemoveInsurance}
          />
        )
      case 5:
        return (
          <IndependencePlanStep
            enabled={independencePlanEnabled}
            cpfRequiresDob={hasCpfPension}
            yearOfBirth={independenceYearOfBirth}
            monthOfBirth={independenceMonthOfBirth}
            monthlyExpenses={independenceMonthlyExpenses}
            targetRetirementAge={independenceTargetAge}
            workingIncomeMonthly={workingIncomeMonthly}
            workingExpensesMonthly={workingExpensesMonthly}
            taxesMonthly={taxesMonthly}
            bonusMonthly={bonusMonthly}
            investmentAllocationPercent={investmentAllocationPercent}
            onEnabledChange={setIndependencePlanEnabled}
            onYearOfBirthChange={setIndependenceYearOfBirth}
            onMonthOfBirthChange={setIndependenceMonthOfBirth}
            onMonthlyExpensesChange={setIndependenceMonthlyExpenses}
            onTargetRetirementAgeChange={setIndependenceTargetAge}
            onWorkingIncomeMonthlyChange={setWorkingIncomeMonthly}
            onWorkingExpensesMonthlyChange={setWorkingExpensesMonthly}
            onTaxesMonthlyChange={setTaxesMonthly}
            onBonusMonthlyChange={setBonusMonthly}
            onInvestmentAllocationPercentChange={setInvestmentAllocationPercent}
            baseCurrency={baseCurrency}
          />
        )
      case 6:
        return (
          <BrokerageStep
            enabled={brokerageEnabled}
            brokerName={brokerageBrokerName}
            currencies={brokerageCurrencies}
            currencyCodes={
              currencies.length > 0
                ? currencies.map((c) => c.code)
                : [baseCurrency || "USD"]
            }
            defaultPortfolioName={portfolioName}
            portfolioMode={brokeragePortfolioMode}
            onEnabledChange={(v) => {
              setBrokerageEnabled(v)
              // Seed the user's base currency so enabling the step always has at
              // least one account to open; they can add/remove from there.
              if (v && brokerageCurrencies.length === 0 && baseCurrency) {
                setBrokerageCurrencies([baseCurrency])
              }
            }}
            onBrokerNameChange={setBrokerageBrokerName}
            onCurrenciesChange={setBrokerageCurrencies}
            onPortfolioModeChange={setBrokeragePortfolioMode}
          />
        )
      case 7:
        return (
          <CompleteStep
            portfolioName={portfolioName}
            bankAccountCount={bankAccounts.length}
            propertyCount={properties.length}
            pensionCount={pensions.length}
            insuranceCount={insurances.length}
            portfolioId={createdPortfolioId}
            independencePlanCreated={independencePlanCreated}
            brokerageCreated={brokerageCreated}
          />
        )
      default:
        return null
    }
  }

  // Per-step heading + lead, lifted out of the individual step
  // components so the user sees what the step is for BEFORE the
  // progress bar takes the visual focus. Renders right under the page's
  // "Account Setup" title.
  const stepIntro: Record<number, { title: string; lead: string }> = {
    1: {
      title: "Welcome to Beancounter!",
      lead: "Quick setup — currency, portfolio, accounts. Skip and finish later in settings if you like.",
    },
    2: {
      title: "Set your currencies",
      lead: "Base currency tracks costs; reporting currency displays values. Default to the same one — they can differ.",
    },
    3: {
      title: "Add your accounts",
      lead: "Tell us about your assets to get a complete picture of your wealth. Optional.",
    },
    5: {
      title: "Quick Independence Check",
      lead: "Want to see how your finances might look in retirement? Just three quick questions.",
    },
    6: {
      title: "Brokerage account",
      lead: "Optional — set up a broker, attach it to a portfolio, and add an opening cash deposit.",
    },
  }
  const intro = stepIntro[currentStep]

  return (
    <div className="max-w-2xl mx-auto">
      {intro && (
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{intro.title}</h2>
          <p className="text-sm text-gray-600">{intro.lead}</p>
        </div>
      )}
      <OnboardingProgress currentStep={currentStep} steps={steps} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <div>
          {currentStep > 1 && currentStep < 7 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              {"Back"}
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {(currentStep === 2 || currentStep === 3) && (
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {"Skip for now"}
            </button>
          )}

          {currentStep < 6 && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className={`px-4 py-2 rounded text-white transition-colors ${
                canProceed
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {"Continue"}
            </button>
          )}

          {currentStep === 6 && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded text-white transition-colors ${
                !isSubmitting
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <Spinner className="mr-2" />
                  {"Creating..."}
                </span>
              ) : (
                "Complete Setup"
              )}
            </button>
          )}

          {currentStep === 7 && (
            <button
              type="button"
              onClick={handleFinish}
              className="px-4 py-2 rounded text-white bg-blue-500 hover:bg-blue-600 transition-colors"
            >
              {"Done"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
