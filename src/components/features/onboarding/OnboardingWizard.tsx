import React, { useState, useMemo, useCallback, useEffect } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import useSwr from "swr"
import { useUser } from "@auth0/nextjs-auth0/client"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Currency } from "types/beancounter"
import OnboardingProgress from "./OnboardingProgress"
import WelcomeStep from "./steps/WelcomeStep"
import CurrencyStep from "./steps/CurrencyStep"
import PortfolioStep from "./steps/PortfolioStep"
import AssetsStep from "./steps/AssetsStep"
import ReviewStep from "./steps/ReviewStep"
import CompleteStep from "./steps/CompleteStep"
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
}

export interface OnboardingState {
  baseCurrency: string
  reportingCurrency: string
  portfolioName: string
  bankAccounts: BankAccount[]
  properties: Property[]
  pensions: Pension[]
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPortfolioId, setCreatedPortfolioId] = useState<string | null>(
    null,
  )

  // Steps configuration
  const steps = useMemo(
    () => [
      { id: 1, label: t("steps.welcome", "Welcome") },
      { id: 2, label: t("steps.currency", "Currency") },
      { id: 3, label: t("steps.portfolio", "Portfolio") },
      { id: 4, label: t("steps.assets", "Assets") },
      { id: 5, label: t("steps.review", "Review") },
      { id: 6, label: t("steps.complete", "Complete") },
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
      // Skip portfolio step when going back from assets or review
      if (currentStep === 4 || currentStep === 5) {
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
          // For DEPOSIT transactions, cashCurrency is required
          ...(cashCurrency && { cashCurrency }),
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

  const createAssets = async (portfolioId: string): Promise<void> => {
    // Create bank accounts
    for (const account of bankAccounts) {
      const assetCode = account.name.replace(/\s+/g, "_").toUpperCase()
      // Backend expects { data: { "CODE": AssetInput } }
      const assetResponse = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            [assetCode]: {
              market: "PRIVATE",
              code: assetCode,
              name: account.name,
              category: "ACCOUNT",
              currency: account.currency,
            },
          },
        }),
      })

      if (assetResponse.ok) {
        const assetData = await assetResponse.json()
        const asset = extractAsset(assetData)

        // Only create transaction if asset was successfully created and has balance
        console.log(
          `Bank account asset created: id=${asset?.id}, balance=${account.balance}`,
        )
        if (asset?.id && account.balance && account.balance > 0) {
          await createTransaction(
            portfolioId,
            asset.id,
            "DEPOSIT",
            account.balance,
            1,
            account.currency,
            new Date().toISOString().split("T")[0],
            account.currency, // cashCurrency same as account currency for deposits
          )
        }
      }
    }

    // Create properties
    for (const property of properties) {
      const assetCode = property.name.replace(/\s+/g, "_").toUpperCase()
      const currentValue = property.value || property.price
      const tradeDate =
        property.purchaseDate || new Date().toISOString().split("T")[0]

      // Backend expects { data: { "CODE": AssetInput } }
      const assetResponse = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            [assetCode]: {
              market: "PRIVATE",
              code: assetCode,
              name: property.name,
              category: "RE",
              currency: baseCurrency,
            },
          },
        }),
      })

      if (assetResponse.ok) {
        const assetData = await assetResponse.json()
        const asset = extractAsset(assetData)

        // Only create transaction if asset was successfully created
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
                marketCode: "PRIVATE",
                priceDate: new Date().toISOString().split("T")[0],
                close: currentValue,
              }),
            })
          }
        }
      }
    }

    // Create pensions
    for (const pension of pensions) {
      const assetCode = pension.name.replace(/\s+/g, "_").toUpperCase()
      // Backend expects { data: { "CODE": AssetInput } }
      const assetResponse = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            [assetCode]: {
              market: "PRIVATE",
              code: assetCode,
              name: pension.name,
              category: "PENSION",
              currency: pension.currency,
            },
          },
        }),
      })

      if (assetResponse.ok) {
        const assetData = await assetResponse.json()
        const asset = extractAsset(assetData)

        // Only proceed if asset was successfully created
        if (asset?.id) {
          // Create PrivateAssetConfig for pension settings
          if (pension.payoutAge || pension.monthlyPayoutAmount) {
            await fetch(`/api/assets/config/${asset.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                isPension: true,
                expectedReturnRate: pension.expectedReturnRate,
                payoutAge: pension.payoutAge,
                monthlyPayoutAmount: pension.monthlyPayoutAmount,
                rentalCurrency: pension.currency,
              }),
            })
          }

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
          pensions.length > 0)
      ) {
        await createAssets(portfolioId)
      }

      // Move to complete step
      setCurrentStep(6)
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
            onBankAccountsChange={setBankAccounts}
            onPropertiesChange={setProperties}
            onPensionsChange={setPensions}
          />
        )
      case 5:
        return (
          <ReviewStep
            baseCurrency={baseCurrency}
            bankAccounts={bankAccounts}
            properties={properties}
            pensions={pensions}
            onRemoveBankAccount={handleRemoveBankAccount}
            onRemoveProperty={handleRemoveProperty}
            onRemovePension={handleRemovePension}
          />
        )
      case 6:
        return (
          <CompleteStep
            portfolioName={portfolioName}
            bankAccountCount={bankAccounts.length}
            propertyCount={properties.length}
            pensionCount={pensions.length}
            portfolioId={createdPortfolioId}
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
          {currentStep > 1 && currentStep < 6 && (
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

          {currentStep < 5 && (
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

          {currentStep === 5 && (
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

          {currentStep === 6 && (
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
