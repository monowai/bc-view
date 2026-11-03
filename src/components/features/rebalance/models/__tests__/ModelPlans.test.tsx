import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ModelPlans from "../ModelPlans"

const mockPush = jest.fn()
jest.mock("next/router", () => ({ useRouter: () => ({ push: mockPush }) }))

const mockMutate = jest.fn()
const hook = {
  plans: [] as any[],
  isLoading: false,
  error: undefined as unknown,
}
jest.mock("../../hooks/useModelPlans", () => ({
  useModelPlans: () => ({ ...hook, mutate: mockMutate }),
}))
const mockCreate = jest.fn()
const mockDelete = jest.fn()
jest.mock("@utils/api/client/rebalance", () => ({
  createModelPlan: (...a: unknown[]) => mockCreate(...a),
  deleteModelPlan: (...a: unknown[]) => mockDelete(...a),
}))

const plan = (over: Record<string, unknown>): any => ({
  id: "p1",
  version: 1,
  status: "DRAFT",
  createdAt: "2026-01-01T00:00:00Z",
  assets: [{}, {}],
  ...over,
})

describe("ModelPlans", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    hook.plans = []
    hook.isLoading = false
    hook.error = undefined
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("shows an error when plans fail to load", () => {
    hook.error = new Error("x")
    render(<ModelPlans modelId="m1" />)
    expect(screen.getByText("Failed to load plan")).toBeInTheDocument()
  })

  it("shows nothing but a spinner while loading", () => {
    hook.isLoading = true
    render(<ModelPlans modelId="m1" />)
    expect(screen.queryByText("Rebalance Plans")).not.toBeInTheDocument()
  })

  it("explains when there are no plans and creates an empty one", async () => {
    mockCreate.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "new" } }),
    })
    const user = userEvent.setup()
    render(<ModelPlans modelId="m1" />)
    expect(screen.getByText("No rebalance plans yet")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Create Plan/ }))
    expect(mockCreate).toHaveBeenCalledWith("m1", {})
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/rebalance/models/m1/plans/new"),
    )
    expect(mockMutate).toHaveBeenCalled()
  })

  it("seeds a new plan from the latest approved version", async () => {
    hook.plans = [
      plan({ id: "a", version: 1, status: "APPROVED" }),
      plan({
        id: "b",
        version: 3,
        status: "APPROVED",
        approvedAt: "2026-02-01T00:00:00Z",
      }),
      plan({ id: "c", version: 4, status: "DRAFT" }),
    ]
    mockCreate.mockResolvedValue({ ok: false })
    const user = userEvent.setup()
    render(<ModelPlans modelId="m1" />)
    const btn = screen.getByRole("button", { name: /New Plan from v3/ })
    expect(btn).toHaveAttribute("title", "Copies allocations from v3")
    await user.click(btn)
    expect(mockCreate).toHaveBeenCalledWith("m1", { sourcePlanId: "b" })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("survives a failed create request", async () => {
    mockCreate.mockRejectedValue(new Error("net"))
    const user = userEvent.setup()
    render(<ModelPlans modelId="m1" />)
    await user.click(screen.getByRole("button", { name: /Create Plan/ }))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(screen.getByRole("button", { name: /Create Plan/ })).toBeEnabled()
  })

  it("lists plans and opens one on row click", async () => {
    hook.plans = [
      plan({
        id: "a",
        version: 2,
        description: "Q1 review",
        approvedAt: "2026-02-01T00:00:00Z",
        status: "APPROVED",
      }),
      plan({ id: "b", version: 3 }),
    ]
    const user = userEvent.setup()
    render(<ModelPlans modelId="m1" />)
    expect(screen.getByText("v2")).toBeInTheDocument()
    expect(screen.getByText("Q1 review")).toBeInTheDocument()
    expect(screen.getByText("-")).toBeInTheDocument()
    await user.click(screen.getByText("v3"))
    expect(mockPush).toHaveBeenCalledWith("/rebalance/models/m1/plans/b")
  })

  it("deletes a plan after confirmation without opening it", async () => {
    hook.plans = [plan({ id: "a" })]
    mockDelete.mockResolvedValue({ ok: true, status: 200 })
    const user = userEvent.setup()
    render(<ModelPlans modelId="m1" />)
    await user.click(screen.getByTitle("Delete"))
    expect(screen.getByText("Delete this plan?")).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
    await user.click(
      screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
    )
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("m1", "a"))
    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
    expect(screen.queryByText("Delete this plan?")).not.toBeInTheDocument()
  })

  it("treats 204 as a successful delete", async () => {
    hook.plans = [plan({ id: "a" })]
    mockDelete.mockResolvedValue({ ok: false, status: 204 })
    const user = userEvent.setup()
    render(<ModelPlans modelId="m1" />)
    await user.click(screen.getByTitle("Delete"))
    await user.click(
      screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
    )
    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
  })

  it("cancel keeps the plan, and a failed delete closes the dialog without refresh", async () => {
    hook.plans = [plan({ id: "a" })]
    mockDelete.mockRejectedValue(new Error("x"))
    const user = userEvent.setup()
    render(<ModelPlans modelId="m1" />)
    await user.click(screen.getByTitle("Delete"))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(mockDelete).not.toHaveBeenCalled()
    await user.click(screen.getByTitle("Delete"))
    await user.click(
      screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
    )
    await waitFor(() =>
      expect(screen.queryByText("Delete this plan?")).not.toBeInTheDocument(),
    )
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
