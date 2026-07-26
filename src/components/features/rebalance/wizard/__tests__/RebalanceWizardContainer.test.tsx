import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { ModelDto, RebalanceScenario } from "types/rebalance"

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}))

const testModel: ModelDto = {
  id: "model-1",
  name: "Growth Model",
  baseCurrency: "USD",
  risk: 3,
  shared: false,
  isOwner: true,
  planCount: 1,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
}

const testModelWithApprovedPlan: ModelDto = {
  ...testModel,
  id: "model-2",
  currentPlanId: "plan-approved-1",
}

// The wizard steps are exercised elsewhere (model list, portfolio picker,
// scenario form) — stubbing them here keeps this test focused on the
// container's own responsibility: building the create-plan/create-execution
// request and handling the response, not re-testing each step's own UI.
let modelToSelect: ModelDto = testModel

jest.mock("../steps/SelectModelStep", () => ({
  __esModule: true,
  default: ({ onSelect }: { onSelect: (model: ModelDto) => void }) => (
    <button onClick={() => onSelect(modelToSelect)}>select-model</button>
  ),
}))
jest.mock("../steps/SelectPortfoliosStep", () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button onClick={() => onChange(["portfolio-1"])}>select-portfolio</button>
  ),
}))
jest.mock("../steps/ConfigureScenarioStep", () => ({
  __esModule: true,
  default: ({
    onScenarioChange,
    onCashDeltaChange,
  }: {
    onScenarioChange: (scenario: RebalanceScenario) => void
    onCashDeltaChange: (delta: number) => void
  }) => (
    <div>
      <button onClick={() => onScenarioChange("REBALANCE")}>
        set-scenario-rebalance
      </button>
      <button onClick={() => onScenarioChange("INVEST_CASH")}>
        set-scenario-invest-cash
      </button>
      <button onClick={() => onCashDeltaChange(5000)}>set-cash-delta</button>
    </div>
  ),
}))
jest.mock("../steps/ReviewStep", () => ({
  __esModule: true,
  default: ({
    onPlanNameChange,
  }: {
    onPlanNameChange: (name: string) => void
  }) => (
    <button onClick={() => onPlanNameChange("My Plan")}>set-plan-name</button>
  ),
}))

import RebalanceWizardContainer from "../RebalanceWizardContainer"

describe("RebalanceWizardContainer submit", () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    modelToSelect = testModel
    global.fetch = mockFetch
  })

  const driveToReview = (options?: {
    scenarioButton?: string
    setCashDelta?: boolean
  }): void => {
    render(<RebalanceWizardContainer />)

    fireEvent.click(screen.getByText("select-model"))
    fireEvent.click(screen.getByText("Next")) // -> step 2

    fireEvent.click(screen.getByText("select-portfolio"))
    fireEvent.click(screen.getByText("Next")) // -> step 3

    if (options?.scenarioButton) {
      fireEvent.click(screen.getByText(options.scenarioButton))
    }
    if (options?.setCashDelta) {
      fireEvent.click(screen.getByText("set-cash-delta"))
    }

    fireEvent.click(screen.getByText("Next")) // -> step 4 (review)

    fireEvent.click(screen.getByText("set-plan-name"))
  }

  describe("model without an approved plan", () => {
    it("posts to the per-model plans endpoint (not the orphaned top-level /plans route)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "plan-99" } }),
      })

      driveToReview()
      fireEvent.click(screen.getByText("Create Plan"))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/rebalance/models/model-1/plans",
          expect.objectContaining({ method: "POST" }),
        )
      })

      // Only description survives the mapping — CreatePlanRequest has no
      // portfolios/scenario/cashDelta field to carry the rest.
      const [, init] = mockFetch.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ description: "My Plan" })
    })

    it("redirects to the per-model plan detail page on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "plan-99" } }),
      })

      driveToReview()
      fireEvent.click(screen.getByText("Create Plan"))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/rebalance/models/model-1/plans/plan-99",
        )
      })
    })

    it("never calls the orphaned top-level /api/rebalance/plans route", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "plan-99" } }),
      })

      driveToReview()
      fireEvent.click(screen.getByText("Create Plan"))

      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      expect(mockFetch).not.toHaveBeenCalledWith(
        "/api/rebalance/plans",
        expect.anything(),
      )
    })
  })

  describe("model with an approved plan", () => {
    beforeEach(() => {
      modelToSelect = testModelWithApprovedPlan
    })

    it("posts portfolios/scenario/cashDelta to /api/rebalance/executions in REBALANCE mode and redirects to the execute page", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "execution-1" } }),
      })

      driveToReview({
        scenarioButton: "set-scenario-rebalance",
        setCashDelta: true,
      })
      fireEvent.click(screen.getByText("Start Execution"))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/rebalance/executions",
          expect.objectContaining({ method: "POST" }),
        )
      })

      const [, init] = mockFetch.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({
        planId: "plan-approved-1",
        portfolioIds: ["portfolio-1"],
        name: "My Plan",
        mode: "REBALANCE",
        cashDelta: 5000,
      })

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/plans"),
        expect.anything(),
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/rebalance/execute?executionId=execution-1",
        )
      })
    })

    it("posts investmentAmount (not cashDelta) to /api/rebalance/executions in INVEST_CASH mode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "execution-2" } }),
      })

      driveToReview({
        scenarioButton: "set-scenario-invest-cash",
        setCashDelta: true,
      })
      fireEvent.click(screen.getByText("Start Execution"))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/rebalance/executions",
          expect.objectContaining({ method: "POST" }),
        )
      })

      const [, init] = mockFetch.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({
        planId: "plan-approved-1",
        portfolioIds: ["portfolio-1"],
        name: "My Plan",
        mode: "INVEST_CASH",
        investmentAmount: 5000,
      })
    })

    it("shows an error and does not navigate when the executions POST fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Server error" }),
      })

      driveToReview({ scenarioButton: "set-scenario-rebalance" })
      fireEvent.click(screen.getByText("Start Execution"))

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument()
      })

      expect(mockPush).not.toHaveBeenCalled()
    })
  })
})
