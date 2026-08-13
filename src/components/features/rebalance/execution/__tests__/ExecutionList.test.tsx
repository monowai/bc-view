import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { ExecutionSummaryDto } from "types/rebalance"

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockMutate = jest.fn()
const mockUseExecutions: {
  executions: ExecutionSummaryDto[]
  isLoading: boolean
  error: Error | undefined
  mutate: jest.Mock
} = {
  executions: [],
  isLoading: false,
  error: undefined,
  mutate: mockMutate,
}
jest.mock("../../hooks/useExecutions", () => ({
  useExecutions: () => mockUseExecutions,
}))

import ExecutionList from "../ExecutionList"

// Spread `overrides` last so an explicit `null` (nullable AD_HOC fields) wins
// over the default — `??`-per-field would collapse an explicit null back to
// the default since `??` treats null as "use the fallback".
const makeSummary = (
  overrides: Partial<ExecutionSummaryDto> = {},
): ExecutionSummaryDto => ({
  id: "exec-1",
  planId: "plan-1",
  planVersion: 2,
  modelId: "model-1",
  modelName: "Growth Model",
  name: undefined,
  portfolioCount: 1,
  status: "DRAFT",
  mode: "REBALANCE",
  snapshotTotalValue: 10000,
  currency: "USD",
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
  ...overrides,
})

describe("ExecutionList — ad-hoc (null plan/model) rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders 'Ad-hoc' model column and 'Ad-hoc Rebalance' title when modelName is null", () => {
    mockUseExecutions.executions = [
      makeSummary({
        id: "adhoc-1",
        planId: null,
        planVersion: null,
        modelId: null,
        modelName: null,
        name: undefined,
      }),
    ]

    render(<ExecutionList />)

    expect(screen.getByText("Ad-hoc Rebalance")).toBeInTheDocument()
    expect(screen.getByText("Ad-hoc")).toBeInTheDocument()
  })

  it("still renders model-based executions with plan version and model name", () => {
    mockUseExecutions.executions = [makeSummary()]

    render(<ExecutionList />)

    expect(screen.getByText("Plan v2")).toBeInTheDocument()
    expect(screen.getByText("Growth Model")).toBeInTheDocument()
  })
})

describe("ExecutionList — delete a DRAFT execution", () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
    mockUseExecutions.executions = [makeSummary({ status: "DRAFT" })]
  })

  // Two "Delete" buttons exist once the confirm dialog is open: the row's
  // icon-only trash button (accessible name from its `title` attribute) and
  // the dialog's confirm button, appended after it in document order.
  const clickConfirmDelete = (): void => {
    fireEvent.click(screen.getByTitle("Delete"))
    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i })
    fireEvent.click(deleteButtons[deleteButtons.length - 1])
  }

  it("revalidates the executions list via SWR mutate on a successful delete, without a full page reload", async () => {
    mockFetch.mockResolvedValue({ ok: true })

    render(<ExecutionList />)
    clickConfirmDelete()

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1)
    })
    expect(mockFetch).toHaveBeenCalledWith("/api/rebalance/executions/exec-1", {
      method: "DELETE",
    })
  })

  it("does not revalidate when the delete request fails", async () => {
    mockFetch.mockResolvedValue({ ok: false })

    render(<ExecutionList />)
    clickConfirmDelete()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
