import React, { useState, useMemo } from "react"
import Alert from "@components/ui/Alert"
import { useRouter } from "next/router"
import Spinner from "@components/ui/Spinner"
import RebalanceWizardProgress from "./RebalanceWizardProgress"
import SelectModelStep from "./steps/SelectModelStep"
import SelectPortfoliosStep from "./steps/SelectPortfoliosStep"
import ConfigureScenarioStep from "./steps/ConfigureScenarioStep"
import ReviewStep from "./steps/ReviewStep"
import {
  ModelDto,
  RebalanceScenario,
  CreatePlanRequest,
  CreateExecutionRequest,
} from "types/rebalance"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

interface RebalanceWizardContainerProps {
  preselectedPortfolioIds?: string[]
}

const RebalanceWizardContainer: React.FC<RebalanceWizardContainerProps> = ({
  preselectedPortfolioIds,
}) => {
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
  const {
    isSubmitting,
    submitError: error,
    handleSubmit: dialogSubmit,
  } = useDialogSubmit({ fallbackError: "Failed to complete wizard" })

  // A model with an approved plan (currentPlanId) can go straight to an
  // execution against it; one without needs a draft plan created first (see
  // handleSubmit below for why the two paths differ).
  const hasApprovedPlan = Boolean(selectedModel?.currentPlanId)

  // Steps configuration
  const steps = useMemo(
    () => [
      { id: 1, label: "Select Model" },
      { id: 2, label: "Select Portfolios" },
      { id: 3, label: "Configure" },
      { id: 4, label: "Review" },
    ],
    [],
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

    await dialogSubmit(async () => {
      if (selectedModel.currentPlanId) {
        // The model already has an approved plan — skip plan creation
        // entirely and go straight to an execution against it, carrying the
        // portfolios/scenario/cashDelta collected in steps 2-3. (A
        // wizard-created plan would be DRAFT and empty, and an empty plan
        // can't be approved, so this path only applies when a plan is
        // already approved.)
        const payload: CreateExecutionRequest = {
          planId: selectedModel.currentPlanId,
          portfolioIds: selectedPortfolioIds,
          name: planName.trim(),
          mode: scenario,
          cashDelta:
            scenario === "REBALANCE" && cashDelta ? cashDelta : undefined,
          investmentAmount:
            scenario === "INVEST_CASH" && cashDelta ? cashDelta : undefined,
        }

        const response = await fetch("/api/rebalance/executions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.detail ||
              errorData.message ||
              "Failed to start execution",
          )
        }

        const result = await response.json()
        await router.push(`/rebalance/execute?executionId=${result.data.id}`)
        return
      }

      // svc-rebalance only creates plans nested under a model
      // (POST /models/{modelId}/plans) — there is no top-level "bind this
      // plan to these portfolios with a scenario" endpoint. CreatePlanRequest
      // only accepts description/sourcePlanId/assets, so the portfolios,
      // scenario and cashDelta collected in steps 2-3 have no home here; they
      // apply later, at execution time (see /rebalance/execute), once this
      // draft plan has assets and is approved.
      const payload: CreatePlanRequest = {
        description: planName.trim(),
      }

      const response = await fetch(
        `/api/rebalance/models/${selectedModel.id}/plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.detail || errorData.message || "Failed to create plan",
        )
      }

      const result = await response.json()
      await router.push(
        `/rebalance/models/${selectedModel.id}/plans/${result.data.id}`,
      )
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <RebalanceWizardProgress currentStep={currentStep} steps={steps} />

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
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
          {currentStep === 1 ? "Cancel" : "Back"}
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
            {"Next"}
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
                <Spinner className="mr-2" />
                {hasApprovedPlan ? "Starting..." : "Creating..."}
              </span>
            ) : hasApprovedPlan ? (
              "Start Execution"
            ) : (
              "Create Plan"
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default RebalanceWizardContainer
