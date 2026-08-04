import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import InvestCashDialog from "@components/features/rebalance/execution/InvestCashDialog"
import { ExecutionDto } from "types/rebalance"

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

const models = [
  {
    id: "model-1",
    name: "Growth",
    currentPlanId: "plan-1",
    currentPlanVersion: 1,
    risk: 3,
  },
]

const plan = { id: "plan-1", assets: [], cashWeight: 0 }

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    if (key === "/api/rebalance/models") return { data: { data: models } }
    if (key?.startsWith("/api/rebalance/models/"))
      return { data: { data: plan } }
    return { data: undefined }
  },
}))

const execution: ExecutionDto = {
  id: "exec-1",
  planId: "plan-1",
  planVersion: 1,
  modelId: "model-1",
  modelName: "Growth",
  portfolioIds: ["p1"],
  snapshotTotalValue: 10000,
  snapshotCashValue: 5000,
  totalPortfolioValue: 10000,
  currency: "USD",
  status: "DRAFT",
  mode: "INVEST_CASH",
  items: [
    {
      id: "item-1",
      assetId: "asset-1",
      assetCode: "US:IUAA",
      assetName: "ISHARES US AGG BND",
      snapshotWeight: 0,
      snapshotValue: 0,
      snapshotQuantity: 0,
      snapshotPrice: 5.6934,
      priceCurrency: "USD",
      planTargetWeight: 1,
      effectiveTarget: 1,
      hasOverride: false,
      deltaValue: 5000,
      deltaQuantity: 100,
      action: "BUY",
      excluded: false,
      locked: false,
      sortOrder: 0,
      isCash: false,
    },
  ],
} as unknown as ExecutionDto

const priceInput = (): HTMLInputElement =>
  screen.getAllByLabelText("Price")[0] as HTMLInputElement

const goToPreview = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  render(
    <InvestCashDialog
      modalOpen={true}
      portfolioId="p1"
      onClose={jest.fn()}
      onSuccess={jest.fn()}
    />,
  )
  await user.type(screen.getByPlaceholderText("10k"), "5000")
  await user.click(screen.getByText("Growth"))
  await user.click(screen.getByText("Preview"))
  await waitFor(() => expect(screen.getAllByLabelText("Price").length).toBe(2))
}

describe("InvestCashDialog price editing", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: execution }),
    }) as unknown as typeof fetch
  })

  it("shows the snapshot price at full precision, not rounded to 2dp", async () => {
    const user = userEvent.setup()
    await goToPreview(user)

    expect(priceInput().value).toBe("5.6934")
  })

  it("keeps every character the user types, decimals included", async () => {
    const user = userEvent.setup()
    await goToPreview(user)

    await user.clear(priceInput())
    await user.type(priceInput(), "12.3456")

    expect(priceInput().value).toBe("12.3456")
  })

  it("survives a partially typed number without reformatting", async () => {
    const user = userEvent.setup()
    await goToPreview(user)

    await user.clear(priceInput())
    await user.type(priceInput(), "0.")

    expect(priceInput().value).toBe("0.")
  })

  it("replaces the whole value on select-all + type", async () => {
    const user = userEvent.setup()
    await goToPreview(user)

    await user.tripleClick(priceInput())
    await user.paste("7.5")

    expect(priceInput().value).toBe("7.5")
  })

  it("ignores non-numeric keystrokes", async () => {
    const user = userEvent.setup()
    await goToPreview(user)

    await user.clear(priceInput())
    await user.type(priceInput(), "1a2")

    expect(priceInput().value).toBe("12")
  })
})
