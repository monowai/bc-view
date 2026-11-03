import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ModelPortfolioList from "../ModelPortfolioList"

const mockPush = jest.fn()
jest.mock("next/router", () => ({ useRouter: () => ({ push: mockPush }) }))
const mockMutate = jest.fn()
const hook = {
  models: [] as any[],
  isLoading: false,
  error: undefined as unknown,
}
jest.mock("../../hooks/useModels", () => ({
  useModels: () => ({ ...hook, mutate: mockMutate }),
}))
const mockDelete = jest.fn()
const mockUpdate = jest.fn()
jest.mock("@utils/api/client/rebalance", () => ({
  deleteModel: (...a: unknown[]) => mockDelete(...a),
  updateModel: (...a: unknown[]) => mockUpdate(...a),
}))

const owned = {
  id: "m1",
  name: "Growth",
  objective: "Grow capital",
  description: "Aggressive",
  baseCurrency: "USD",
  risk: 3,
  shared: false,
  isOwner: true,
  currentPlanVersion: 2,
}
const foreign = {
  id: "m2",
  name: "Public Income",
  baseCurrency: "SGD",
  shared: true,
  isOwner: false,
}

describe("ModelPortfolioList", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    hook.models = [owned, foreign]
    hook.isLoading = false
    hook.error = undefined
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("shows an error when models fail to load", () => {
    hook.error = new Error("x")
    render(<ModelPortfolioList />)
    expect(screen.getByText("Failed to load models")).toBeInTheDocument()
  })

  it("renders a skeleton, not the table, while loading", () => {
    hook.isLoading = true
    render(<ModelPortfolioList />)
    expect(screen.queryByText("Model Name")).not.toBeInTheDocument()
  })

  it("invites creating the first model", async () => {
    hook.models = []
    const user = userEvent.setup()
    render(<ModelPortfolioList />)
    expect(screen.getByText("No model portfolios yet")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Create Model/ }))
    expect(mockPush).toHaveBeenCalledWith("/rebalance/models/__NEW__")
  })

  it("shows model details, plan version, risk and public badge", () => {
    render(<ModelPortfolioList />)
    expect(screen.getByText("Grow capital")).toBeInTheDocument()
    expect(screen.getByText("v2")).toBeInTheDocument()
    expect(screen.getByText("None")).toBeInTheDocument()
    expect(screen.getByLabelText("Risk 3 of 5")).toBeInTheDocument()
    // unspecified risk defaults to 5
    expect(screen.getByLabelText("Risk 5 of 5")).toBeInTheDocument()
    expect(screen.getByText("Public")).toBeInTheDocument()
    expect(screen.getByText("-")).toBeInTheDocument()
  })

  it("opens a model on row click and from Edit; non-owners get no actions", async () => {
    const user = userEvent.setup()
    render(<ModelPortfolioList />)
    await user.click(screen.getByText("Growth"))
    expect(mockPush).toHaveBeenLastCalledWith("/rebalance/models/m1")
    mockPush.mockClear()
    await user.click(screen.getByTitle("Edit"))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith("/rebalance/models/m1")
    const row = screen.getByText("Public Income").closest("tr") as HTMLElement
    expect(within(row).queryByTitle("Delete")).not.toBeInTheDocument()
  })

  it("toggles a model public, sending its full definition", async () => {
    mockUpdate.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<ModelPortfolioList />)
    await user.click(screen.getByTitle("Make public"))
    expect(mockUpdate).toHaveBeenCalledWith("m1", {
      name: "Growth",
      objective: "Grow capital",
      description: "Aggressive",
      baseCurrency: "USD",
      shared: true,
      risk: 3,
    })
    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
  })

  it("offers to make a shared model private, and tolerates update failure", async () => {
    hook.models = [{ ...owned, shared: true }]
    mockUpdate.mockRejectedValue(new Error("x"))
    const user = userEvent.setup()
    render(<ModelPortfolioList />)
    await user.click(screen.getByTitle("Make private"))
    expect(mockUpdate.mock.calls[0][1].shared).toBe(false)
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it("deletes after confirmation and refreshes", async () => {
    mockDelete.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<ModelPortfolioList />)
    await user.click(screen.getByTitle("Delete"))
    expect(screen.getByText("Delete this model portfolio?")).toBeInTheDocument()
    await user.click(
      screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
    )
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("m1"))
    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
    expect(
      screen.queryByText("Delete this model portfolio?"),
    ).not.toBeInTheDocument()
  })

  it("cancel keeps the model; failed delete closes the dialog without refresh", async () => {
    mockDelete.mockRejectedValue(new Error("x"))
    const user = userEvent.setup()
    render(<ModelPortfolioList />)
    await user.click(screen.getByTitle("Delete"))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(mockDelete).not.toHaveBeenCalled()
    await user.click(screen.getByTitle("Delete"))
    await user.click(
      screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
    )
    await waitFor(() =>
      expect(
        screen.queryByText("Delete this model portfolio?"),
      ).not.toBeInTheDocument(),
    )
    expect(mockMutate).not.toHaveBeenCalled()
  })

  describe("selectable mode", () => {
    it("selects a model by row or radio, with no action column", async () => {
      const onSelect = jest.fn()
      const user = userEvent.setup()
      render(
        <ModelPortfolioList selectable onSelect={onSelect} selectedId="m2" />,
      )
      expect(screen.queryByText("Actions")).not.toBeInTheDocument()
      const radios = screen.getAllByRole("radio")
      expect(radios[1]).toBeChecked()
      expect(radios[0]).not.toBeChecked()
      await user.click(screen.getByText("Growth"))
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "m1" }),
      )
      expect(mockPush).not.toHaveBeenCalled()
      onSelect.mockClear()
      await user.click(radios[0])
      expect(onSelect).toHaveBeenCalled()
    })
  })
})
