import React, { useState, useMemo, useCallback, useEffect } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import useSwr from "swr"
import { useUser } from "@auth0/nextjs-auth0/client"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Currency, PolicyType, SubAccountRequest } from "types/beancounter"
import OnboardingProgress from "./OnboardingProgress"
import WelcomeStep from "./steps/WelcomeStep"
import CurrencyStep from "./steps/CurrencyStep"
import PortfolioStep from "./steps/PortfolioStep"
import AssetsStep from "./steps/AssetsStep"
import ReviewStep from "./steps/ReviewStep"
import CompleteStep from "./steps/CompleteStep"
import IndependencePlanStep from "./steps/IndependencePlanStep"
import { useRegistration } from "@contexts/RegistrationContext"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

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

function generateAssetCode(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (words.length === 0) return "ASSET"
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
  }
  return words[0].substring(0, 4).toUpperCase()
}

const OnboardingWizard: React.FC = () => {
  const { t } = useTranslation("onboarding")
  const router = useRouter()
  const { markOnboardingComplete } = useRegistration()
  const { user } = useUser()
  const { preferences } = useUserPreferences()

  // Fetch currencies from backend
  const { data: ccyResponse } = useSwr(ccyKey, simpleFetcher(ccyKey))
  const currencies: Currency[] = ccyResponse?.data || []

  // Wizard state - no pre-selection, user must explicitly choose
  const [currentStep, setCurrentStep] = useState(1)
  const [preferredName, setPreferredName] = useState("")
  const [baseCurrency, setBaseCurrency] = useState("")
  const [reportingCurrency, setReportingCurrency] = useState("")
  const [prefsInitialized, setPrefsInitialized] = useState(false)

  // Pre-fill fields from user preferences or Auth0 profile
  useEffect(() => {
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

      setPrefsInitialized(true)
    }
  }, [preferences, user, prefsInitialized])
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
  const [independencePlanEnabled, setIndependencePlanEnabled] = useState(false)
  const [independenceYearOfBirth, setIndependenceYearOfBirth] = useState(
    currentYear - 55,
  )
  const [independenceMonthlyExpenses, setIndependenceMonthlyExpenses] =
    useState(0)
  const [independenceTargetAge, setIndependenceTargetAge] = useState(65)
  const [independencePlanCreated, setIndependencePlanCreated] = useState(false)

  // Steps configuration
  const steps = useMemo(
    () => [
      { id: 1, label: t("steps.welcome", "Welcome") },
      { id: 2, label: t("steps.currency", "Currency") },
      { id: 3, label: t("steps.portfolio", "Portfolio") },
      { id: 4, label: t("steps.assets", "Assets") },
      { id: 5, label: t("steps.review", "Review") },
      { id: 6, label: t("steps.independence", "Independence") },
      { id: 7, label: t("steps.complete", "Complete") },
    ],
    [t],
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

  // Validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return true // Welcome - always can proceed
      case 2:
        return baseCurrency !== ""
      case 3:
        return portfolioCode.trim() !== "" && portfolioName.trim() !== ""
      case 4:
        return true // Assets are optional
      case 5:
        return true // Review - always can proceed
      case 6:
        return true // Independence - always can proceed (optional step)
      case 7:
        return true
      default:
        return false
    }
  }, [currentStep, baseCurrency, portfolioCode, portfolioName])

  const handleNext = (): void => {
    if (currentStep < steps.length && canProceed) {
      // Auto-set portfolio code/name when moving from currency step
      if (currentStep === 2 && baseCurrency) {
        setPortfolioCode(baseCurrency)
        setPortfolioName(`${baseCurrency} Portfolio`)
        // Skip portfolio step, go directly to assets
        setCurrentStep(4)
        return
      }
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = (): void => {
    if (currentStep > 1) {
      // Skip portfolio step when going back from assets, review, or independence
      if (currentStep === 4 || currentStep === 5 || currentStep === 6) {
        setCurrentStep(currentStep - 1 === 3 ? 2 : currentStep - 1)
        return
      }
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = useCallback(() => {
    // Skip moves to the next step
    if (currentStep === 2) {
      // Skipping currency - use USD as default and auto-create portfolio
      const currency = baseCurrency || "USD"
      setBaseCurrency(currency)
      setReportingCurrency(currency)
      setPortfolioCode(currency)
      setPortfolioName(`${currency} Portfolio`)
      setCurrentStep(4) // Skip to assets
      return
    }
    if (currentStep === 4) {
      // Skipping assets step - go to review
      setCurrentStep(5)
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

  const createAssets = async (portfolioId: string): Promise<void> => {
    // Fetch existing user assets to avoid creating duplicates
    const existingResponse = await fetch("/api/assets")
    const existingAssets: Record<string, { id: string }> =
      existingResponse.ok
        ? ((await existingResponse.json()) as { data: Record<string, { id: string }> })
            .data || {}
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
            lockedUntilDate: pension.lockedUntilDate || null,
            subAccounts: pension.subAccounts,
          }),
        })

        // Create ADD transaction for initial balance if provided (doesn't impact cash)
        if (pension.balance && pension.balance > 0) {
          await createTransaction(
            portfolioId,
            asset.id,
            "ADD",
            pension.balance,
            1,
            pension.currency,
            new Date().toISOString().split("T")[0],
          )
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
  }

  const handleComplete = async (): Promise<void> => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Save user preferences with currency settings
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredName: preferredName || undefined,
          baseCurrencyCode: baseCurrency,
          reportingCurrencyCode: reportingCurrency,
        }),
      })

      // Create portfolio with reporting currency as display currency
      // and base currency as cost tracking currency
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
      // Response is { data: [Portfolio] }
      const portfolioId = portfolioData.data[0]?.id
      setCreatedPortfolioId(portfolioId)

      // Create assets if any
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
          <PortfolioStep
            portfolioCode={portfolioCode}
            portfolioName={portfolioName}
            baseCurrency={baseCurrency}
            reportingCurrency={reportingCurrency}
            onCodeChange={setPortfolioCode}
            onNameChange={setPortfolioName}
          />
        )
      case 4:
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
      case 5:
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
      case 6:
        return (
          <IndependencePlanStep
            enabled={independencePlanEnabled}
            yearOfBirth={independenceYearOfBirth}
            monthlyExpenses={independenceMonthlyExpenses}
            targetRetirementAge={independenceTargetAge}
            onEnabledChange={setIndependencePlanEnabled}
            onYearOfBirthChange={setIndependenceYearOfBirth}
            onMonthlyExpensesChange={setIndependenceMonthlyExpenses}
            onTargetRetirementAgeChange={setIndependenceTargetAge}
            baseCurrency={baseCurrency}
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
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
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
              {t("back", "Back")}
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {(currentStep === 2 || currentStep === 4) && (
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t("skipForNow", "Skip for now")}
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
              {t("continue", "Continue")}
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
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  {t("creating", "Creating...")}
                </span>
              ) : (
                t("completeSetup", "Complete Setup")
              )}
            </button>
          )}

          {currentStep === 7 && (
            <button
              type="button"
              onClick={handleFinish}
              className="px-4 py-2 rounded text-white bg-blue-500 hover:bg-blue-600 transition-colors"
            >
              {t("done", "Done")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
