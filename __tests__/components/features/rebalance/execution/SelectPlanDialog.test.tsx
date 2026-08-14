import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SelectPlanDialog from "@components/features/rebalance/execution/SelectPlanDialog"
import { ModelDto, PlanDto } from "types/rebalance"

const models: ModelDto[] = [
  {
    id: "model-1",
    name: "Growth",
    baseCurrency: "USD",
    risk: 3,
    shared: false,
    isOwner: true,
    planCount: 1,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    currentPlanId: "plan-1",
    currentPlanVersion: 1,
    currentPlanStatus: "APPROVED",
  },
]

const plan: PlanDto = {
  id: "plan-1",
  modelId: "model-1",
  modelName: "Growth",
  version: 1,
  status: "APPROVED",
  assets: [],
  cashWeight: 0,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
}

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    if (key === "/api/rebalance/models") return { data: { data: models } }
    return { data: undefined }
  },
}))

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof SelectPlanDialog>> = {},
): {
  onSelectPlan: jest.Mock
  onClose: jest.Mock
  onCreateNew: jest.Mock
} => {
  const onSelectPlan = jest.fn()
  const onClose = jest.fn()
  const onCreateNew = jest.fn()
  render(
    <SelectPlanDialog
      modalOpen={true}
      portfolioId="p1"
      onClose={onClose}
      onSelectPlan={onSelectPlan}
      onCreateNew={onCreateNew}
      {...overrides}
    />,
  )
  return { onSelectPlan, onClose, onCreateNew }
}

describe("SelectPlanDialog — fetch failure surfacing (#1157)", () => {
  it("shows a visible error when the approved-plan fetch responds not-ok, instead of silently doing nothing", async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Server error" }),
    }) as unknown as typeof fetch
    const { onSelectPlan } = renderDialog()

    await user.click(screen.getByText("Growth"))

    expect(await screen.findByText("Server error")).toBeInTheDocument()
    expect(onSelectPlan).not.toHaveBeenCalled()
  })

  it("shows a visible error when the approved-plan fetch throws (network failure)", async () => {
    const user = userEvent.setup()
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(
        new Error("Network down"),
      ) as unknown as typeof fetch
    const { onSelectPlan } = renderDialog()

    await user.click(screen.getByText("Growth"))

    expect(await screen.findByText(/Network down/i)).toBeInTheDocument()
    expect(onSelectPlan).not.toHaveBeenCalled()
  })

  it("clears a previous error and proceeds normally when the retry succeeds", async () => {
    const user = userEvent.setup()
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Server error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: plan }),
      }) as unknown as typeof fetch
    const { onSelectPlan } = renderDialog()

    await user.click(screen.getByText("Growth"))
    expect(await screen.findByText("Server error")).toBeInTheDocument()

    await user.click(screen.getByText("Growth"))

    await waitFor(() =>
      expect(onSelectPlan).toHaveBeenCalledWith(models[0], plan, false),
    )
    expect(screen.queryByText("Server error")).not.toBeInTheDocument()
  })

  it("success path is unchanged: onSelectPlan is called with the fetched plan", async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: plan }),
    }) as unknown as typeof fetch
    const { onSelectPlan } = renderDialog()

    await user.click(screen.getByText("Growth"))

    await waitFor(() =>
      expect(onSelectPlan).toHaveBeenCalledWith(models[0], plan, false),
    )
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })
})
