import React, { useState, useMemo } from "react"
import useSwr from "swr"
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
  ExecutionMode,
  CreatePlanRequest,
  CreateExecutionRequest,
} from "types/rebalance"
import { PortfolioResponses } from "types/beancounter"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { isPlanApproved } from "@components/features/rebalance/hooks/useApprovedModels"

interface RebalanceWizardContainerProps {
  preselectedPortfolioIds?: string[]
}

// RebalanceScenario ("INVEST_CASH" | "REBALANCE") happens to be a subset of
// ExecutionMode's members ("REBALANCE" | "INVEST_CASH" | "AD_HOC"), so a bare
// `mode: scenario` assignment type-checks today — but only because the two
// unions currently overlap by coincidence. An explicit map means a future
// change to either type (e.g. ExecutionMode losing a member, or
// RebalanceScenario gaining one this map doesn't cover) fails to compile
// here instead of silently relying on structural luck — the `Record<...>`
// annotation makes TS enforce every RebalanceScenario key is present.
const SCENARIO_TO_EXECUTION_MODE: Record<RebalanceScenario, ExecutionMode> = {
  REBALANCE: "REBALANCE",
  INVEST_CASH: "INVEST_CASH",
}

function toExecutionMode(scenario: RebalanceScenario): ExecutionMode {
  return SCENARIO_TO_EXECUTION_MODE[scenario]
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

  // Gate on plan *status*, not merely the presence of a currentPlanId
  // (#1157) — a currentPlanId can point at a DRAFT plan, which isn't yet
  // executable. Shared predicate (see isPlanApproved's own doc for the
  // backward-compat/missing-status rationale) so this can never drift from
  // useApprovedModels' gate.
  const hasApprovedPlan =
    selectedModel !== null && isPlanApproved(selectedModel)

  // Backs the cash-delta currency label in steps 3-4. The model's
  // baseCurrency is the primary source once one's selected; the fallback (for
  // the brief window before that, or a defensively-null model) derives from
  // the selected portfolio's report currency rather than a hard-coded
  // country default (#1156) — never observable via the wizard's own
  // navigation gating today (step 3 is unreachable without a model), but the
  // fallback should still be honest if that ever changes.
  const { data: portfoliosData } = useSwr<PortfolioResponses>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const planCurrency = useMemo(() => {
    if (selectedModel?.baseCurrency) return selectedModel.baseCurrency
    const portfolios = portfoliosData?.data || []
    const firstSelectedPortfolio = portfolios.find((p) =>
      selectedPortfolioIds.includes(p.id),
    )
    return (
      firstSelectedPortfolio?.currency.code ||
      portfolios[0]?.currency.code ||
      ""
    )
  }, [selectedModel, portfoliosData, selectedPortfolioIds])

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

    // A model with an APPROVED current plan goes straight to an execution
    // carrying the portfolios/scenario/cashDelta from steps 2-3. Without one
    // (no plan at all, or the current plan is still DRAFT — see
    // hasApprovedPlan above), only a draft plan can be created —
    // CreatePlanRequest has no home for those values; they apply at
    // execution time, once the plan is approved.
    const { currentPlanId, id: modelId } = selectedModel
    const target: {
      url: string
      payload: CreateExecutionRequest | CreatePlanRequest
      route: (id: string) => string
    } = hasApprovedPlan
      ? {
          url: "/api/rebalance/executions",
          payload: {
            planId: currentPlanId!,
            portfolioIds: selectedPortfolioIds,
            name: planName.trim(),
            mode: toExecutionMode(scenario),
            cashDelta:
              scenario === "REBALANCE" ? cashDelta || undefined : undefined,
            investmentAmount:
              scenario === "INVEST_CASH" ? cashDelta || undefined : undefined,
          },
          route: (id) => `/rebalance/execute?executionId=${id}`,
        }
      : {
          url: `/api/rebalance/models/${modelId}/plans`,
          payload: { description: planName.trim() },
          route: (id) => `/rebalance/models/${modelId}/plans/${id}`,
        }

    await dialogSubmit(async () => {
      const response = await fetch(target.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target.payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.detail || errorData.message || "Failed to complete wizard",
        )
      }

      const result = await response.json()
      await router.push(target.route(result.data.id))
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
            planCurrency={planCurrency}
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
            planCurrency={planCurrency}
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
