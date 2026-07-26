import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { ModelDto } from "types/rebalance"

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

// The wizard steps are exercised elsewhere (model list, portfolio picker,
// scenario form) — stubbing them here keeps this test focused on the
// container's own responsibility: building the create-plan request and
// handling the response, not re-testing each step's own UI.
jest.mock("../steps/SelectModelStep", () => ({
  __esModule: true,
  default: ({ onSelect }: { onSelect: (model: ModelDto) => void }) => (
    <button onClick={() => onSelect(testModel)}>select-model</button>
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
  default: () => <div>configure-scenario</div>,
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
    global.fetch = mockFetch
  })

  const driveToReview = (): void => {
    render(<RebalanceWizardContainer />)

    fireEvent.click(screen.getByText("select-model"))
    fireEvent.click(screen.getByText("Next")) // -> step 2

    fireEvent.click(screen.getByText("select-portfolio"))
    fireEvent.click(screen.getByText("Next")) // -> step 3

    fireEvent.click(screen.getByText("Next")) // -> step 4 (review)

    fireEvent.click(screen.getByText("set-plan-name"))
  }

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
