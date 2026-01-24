import React, { useState, useMemo } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import RebalanceWizardProgress from "./RebalanceWizardProgress"
import SelectModelStep from "./steps/SelectModelStep"
import SelectPortfoliosStep from "./steps/SelectPortfoliosStep"
import ConfigureScenarioStep from "./steps/ConfigureScenarioStep"
import ReviewStep from "./steps/ReviewStep"
import {
  ModelDto,
  RebalanceScenario,
  CreateRebalancePlanRequest,
} from "types/rebalance"

interface RebalanceWizardContainerProps {
  preselectedPortfolioIds?: string[]
}

const RebalanceWizardContainer: React.FC<RebalanceWizardContainerProps> = ({
  preselectedPortfolioIds,
}) => {
  const { t } = useTranslation("common")
  const router = useRouter()

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedModel, setSelectedModel] = useState<ModelDto | null>(null)
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>(
    preselectedPortfolioIds || [],
  )
  const [scenario, setScenario] = useState<RebalanceScenario>("REBALANCE")
  const [cashDelta, setCashDelta] = useState(0)
  const [planName, setPlanName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Steps configuration
  const steps = useMemo(
    () => [
      { id: 1, label: t("rebalance.wizard.step1", "Select Model") },
      { id: 2, label: t("rebalance.wizard.step2", "Select Portfolios") },
      { id: 3, label: t("rebalance.wizard.step3", "Configure") },
      { id: 4, label: t("rebalance.wizard.step4", "Review") },
    ],
    [t],
  )

  // Validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return selectedModel !== null
      case 2:
        return selectedPortfolioIds.length > 0
      case 3:
        return true // Always can proceed from configure
      case 4:
        return planName.trim() !== ""
      default:
        return false
    }
  }, [currentStep, selectedModel, selectedPortfolioIds, planName])

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

  const handleSubmit = async (): Promise<void> => {
    if (
      !selectedModel ||
      selectedPortfolioIds.length === 0 ||
      !planName.trim()
    ) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload: CreateRebalancePlanRequest = {
        name: planName.trim(),
        modelPortfolioId: selectedModel.id,
        portfolioIds: selectedPortfolioIds,
        planCurrency: selectedModel.baseCurrency,
        scenario,
        cashDelta: cashDelta || undefined,
      }

      const response = await fetch("/api/rebalance/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(
          errorData.detail || errorData.message || "Failed to create plan",
        )
        return
      }

      const result = await response.json()
      await router.push(`/rebalance/plans/${result.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <RebalanceWizardProgress currentStep={currentStep} steps={steps} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        {currentStep === 1 && (
          <SelectModelStep
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
          />
        )}
        {currentStep === 2 && (
          <SelectPortfoliosStep
            selectedPortfolioIds={selectedPortfolioIds}
            onChange={setSelectedPortfolioIds}
            preselectedIds={preselectedPortfolioIds}
          />
        )}
        {currentStep === 3 && (
          <ConfigureScenarioStep
            scenario={scenario}
            onScenarioChange={setScenario}
            cashDelta={cashDelta}
            onCashDeltaChange={setCashDelta}
            planCurrency={selectedModel?.baseCurrency || "USD"}
          />
        )}
        {currentStep === 4 && (
          <ReviewStep
            planName={planName}
            onPlanNameChange={setPlanName}
            selectedModel={selectedModel}
            portfolioCount={selectedPortfolioIds.length}
            scenario={scenario}
            cashDelta={cashDelta}
            planCurrency={selectedModel?.baseCurrency || "USD"}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={currentStep === 1 ? () => router.back() : handleBack}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          {currentStep === 1 ? t("cancel", "Cancel") : t("back", "Back")}
        </button>
        {currentStep < steps.length ? (
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
            {t("next", "Next")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed || isSubmitting}
            className={`px-4 py-2 rounded text-white transition-colors ${
              canProceed && !isSubmitting
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
              t("rebalance.plans.create", "Create Plan")
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default RebalanceWizardContainer
