import React, { useState, useMemo, useCallback } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import useSwr from "swr"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Currency } from "types/beancounter"
import OnboardingProgress from "./OnboardingProgress"
import WelcomeStep from "./steps/WelcomeStep"
import CurrencyStep from "./steps/CurrencyStep"
import PortfolioStep from "./steps/PortfolioStep"
import AssetsStep from "./steps/AssetsStep"
import CompleteStep from "./steps/CompleteStep"
import { useRegistration } from "@contexts/RegistrationContext"

export interface BankAccount {
  name: string
  currency: string
  balance?: number
}

export interface Property {
  name: string
  price: number
  value?: number
}

export interface OnboardingState {
  baseCurrency: string
  reportingCurrency: string
  portfolioName: string
  bankAccounts: BankAccount[]
  properties: Property[]
}

const OnboardingWizard: React.FC = () => {
  const { t } = useTranslation("onboarding")
  const router = useRouter()
  const { markOnboardingComplete } = useRegistration()

  // Fetch currencies from backend
  const { data: ccyResponse } = useSwr(ccyKey, simpleFetcher(ccyKey))
  const currencies: Currency[] = ccyResponse?.data || []

  // Wizard state - no pre-selection, user must explicitly choose
  const [currentStep, setCurrentStep] = useState(1)
  const [preferredName, setPreferredName] = useState("")
  const [baseCurrency, setBaseCurrency] = useState("")
  const [reportingCurrency, setReportingCurrency] = useState("")
  const [portfolioCode, setPortfolioCode] = useState("")
  const [portfolioName, setPortfolioName] = useState("")
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [properties, setProperties] = useState<Property[]>([])
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
      { id: 5, label: t("steps.complete", "Complete") },
    ],
    [t],
  )

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
        return true
      default:
        return false
    }
  }, [currentStep, baseCurrency, portfolioCode, portfolioName])

  const handleNext = (): void => {
    if (currentStep < steps.length && canProceed) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = (): void => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = useCallback(async () => {
    // Skip moves to the next step
    if (currentStep === 4) {
      // Skipping assets step - still need to create portfolio
      // Use defaults if empty
      const code = portfolioCode.trim() || "PERSONAL"
      const name = portfolioName.trim() || "Personal Portfolio"
      setPortfolioCode(code)
      setPortfolioName(name)
      setIsSubmitting(true)
      try {
        // Save user preferences
        await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preferredName: preferredName || undefined,
            baseCurrencyCode: baseCurrency,
            reportingCurrencyCode: reportingCurrency,
          }),
        })

        // Create portfolio without assets
        const portfolioResponse = await fetch("/api/portfolios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [
              {
                code: code,
                name: name,
                currency: reportingCurrency,
                base: baseCurrency,
              },
            ],
          }),
        })

        if (portfolioResponse.ok) {
          const portfolioData = await portfolioResponse.json()
          // Response is { data: [Portfolio] }
          setCreatedPortfolioId(portfolioData.data[0]?.id)
        }
        setCurrentStep(5)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setup failed")
      } finally {
        setIsSubmitting(false)
      }
    } else if (currentStep === 3 && !portfolioCode.trim()) {
      // Skipping portfolio step - use defaults
      setPortfolioCode("PERSONAL")
      setPortfolioName("Personal Portfolio")
      setCurrentStep(currentStep + 1)
    } else if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }, [
    currentStep,
    steps.length,
    portfolioCode,
    portfolioName,
    preferredName,
    baseCurrency,
    reportingCurrency,
  ])

  const createAssets = async (portfolioId: string): Promise<void> => {
    // Create bank accounts
    for (const account of bankAccounts) {
      const assetResponse = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: "PRIVATE",
          code: account.name.replace(/\s+/g, "_").toUpperCase(),
          name: account.name,
          category: "ACCOUNT",
          currency: account.currency,
        }),
      })

      if (assetResponse.ok && account.balance && account.balance > 0) {
        const assetData = await assetResponse.json()
        const asset = assetData.data

        // Create deposit transaction for initial balance
        await fetch(`/api/trns/portfolio/${portfolioId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trnType: "DEPOSIT",
            asset: {
              id: asset.id,
              market: { code: "PRIVATE" },
              code: asset.code,
            },
            quantity: account.balance,
            price: 1,
            tradeCurrency: account.currency,
            tradeDate: new Date().toISOString().split("T")[0],
          }),
        })
      }
    }

    // Create properties
    for (const property of properties) {
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: "PRIVATE",
          code: property.name.replace(/\s+/g, "_").toUpperCase(),
          name: property.name,
          category: "RE",
          currency: baseCurrency,
          priceSymbol: String(property.value || property.price),
        }),
      })
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
      if (bankAccounts.length > 0 || properties.length > 0) {
        await createAssets(portfolioId)
      }

      // Move to complete step
      setCurrentStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinish = (): void => {
    markOnboardingComplete()
    router.push("/wealth")
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
            onBankAccountsChange={setBankAccounts}
            onPropertiesChange={setProperties}
          />
        )
      case 5:
        return (
          <CompleteStep
            portfolioName={portfolioName}
            bankAccountCount={bankAccounts.length}
            propertyCount={properties.length}
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
          {currentStep > 1 && currentStep < 5 && (
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
          {currentStep < 5 && (
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t("skipForNow", "Skip for now")}
            </button>
          )}

          {currentStep < 4 && (
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

          {currentStep === 4 && (
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

          {currentStep === 5 && (
            <button
              type="button"
              onClick={handleFinish}
              className="px-4 py-2 rounded text-white bg-blue-500 hover:bg-blue-600 transition-colors"
            >
              {t("goToWealth", "Go to Wealth Dashboard")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
