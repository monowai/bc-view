import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SetBalanceDialog from "../SetBalanceDialog"
import { makeAsset, SGD } from "@test-fixtures/asset"
import { makePortfolio } from "@test-fixtures/portfolio"

const mockGetAssetConfig = jest.fn()
const mockGetAssetPositions = jest.fn()
const mockCreateTrns = jest.fn()

jest.mock("@utils/api/client/assets", () => ({
  getAssetConfig: (...a: unknown[]) => mockGetAssetConfig(...a),
  getAssetPositions: (...a: unknown[]) => mockGetAssetPositions(...a),
}))
jest.mock("@utils/api/client/trns", () => ({
  createTrns: (...a: unknown[]) => mockCreateTrns(...a),
}))
jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({
    data: {
      data: [
        makePortfolio({ id: "p-1", code: "ONE", name: "First" }),
        makePortfolio({ id: "p-2", code: "TWO", name: "Second" }),
      ],
    },
  }),
}))

const asset = makeAsset({
  id: "acct-1",
  code: "SAVINGS",
  name: "Savings Account",
  displayCode: "SAVINGS",
  assetCategory: { id: "ACCOUNT", name: "Account" },
  market: { code: "PRIVATE", name: "Private", currency: SGD },
})

const json = (body: unknown, ok = true): Response =>
  ({ ok, json: () => Promise.resolve(body) }) as Response

function mockBackend(opts: {
  balance?: number
  portfolioId?: string
  subAccounts?: { code: string; displayName?: string; balance?: number }[]
}): void {
  mockGetAssetConfig.mockResolvedValue(
    json({ data: { subAccounts: opts.subAccounts ?? [] } }),
  )
  mockGetAssetPositions.mockResolvedValue(
    json({
      data: opts.portfolioId
        ? [
            {
              portfolio: makePortfolio({ id: opts.portfolioId }),
              balance: opts.balance ?? 0,
            },
          ]
        : [],
    }),
  )
}

function renderDialog(): { onClose: jest.Mock; onComplete: jest.Mock } {
  const onClose = jest.fn()
  const onComplete = jest.fn().mockResolvedValue(undefined)
  render(
    <SetBalanceDialog
      asset={asset}
      onClose={onClose}
      onComplete={onComplete}
    />,
  )
  return { onClose, onComplete }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("SetBalanceDialog", () => {
  it("shows the asset, current balance and defaults the portfolio to where it is held", async () => {
    mockBackend({ balance: 1200, portfolioId: "p-2" })
    renderDialog()
    expect(screen.getByText("Savings Account")).toBeVisible()
    expect(screen.getByText(/SAVINGS - Bank Account/)).toBeVisible()
    expect(await screen.findByText(/1,200/)).toBeVisible()
    expect(screen.getByRole("combobox")).toHaveValue("p-2")
  })

  it("keeps Set Balance disabled until the balance changes", async () => {
    mockBackend({ balance: 100, portfolioId: "p-1" })
    renderDialog()
    await screen.findByText(/Current Balance/)
    expect(screen.getByRole("button", { name: "Set Balance" })).toBeDisabled()
  })

  it("records a BALANCE transaction for the new total and completes", async () => {
    const user = userEvent.setup()
    mockBackend({ balance: 100, portfolioId: "p-1" })
    mockCreateTrns.mockResolvedValue(json({}))
    const { onComplete } = renderDialog()
    await screen.findByText(/Current Balance/)

    const input = screen.getByPlaceholderText(
      "Enter the balance you want to set",
    )
    await user.tripleClick(input)
    await user.keyboard("250")
    await user.tab()
    expect(await screen.findByText("New snapshot:")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Set Balance" }))

    await waitFor(() => expect(mockCreateTrns).toHaveBeenCalled())
    const req = mockCreateTrns.mock.calls[0][0]
    expect(req.portfolioId).toBe("p-1")
    expect(req.data[0]).toMatchObject({
      assetId: "acct-1",
      trnType: "BALANCE",
      quantity: 250,
      tradeAmount: 250,
      status: "SETTLED",
    })
    expect(req.data[0].subAccounts).toBeUndefined()
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })

  it("sends per-sub-account balances for composite policies", async () => {
    const user = userEvent.setup()
    mockBackend({
      balance: 30,
      portfolioId: "p-1",
      subAccounts: [
        { code: "OA", displayName: "Ordinary", balance: 10 },
        { code: "SA", balance: 20 },
        { code: "MA" },
      ],
    })
    mockCreateTrns.mockResolvedValue(json({}))
    renderDialog()
    const ordinary = await screen.findByLabelText("Ordinary")
    // unchanged total (10 + 20 + 0 = 30) leaves the button disabled
    expect(screen.getByRole("button", { name: "Set Balance" })).toBeDisabled()

    await user.tripleClick(ordinary)
    await user.keyboard("15")
    await user.tab()
    await user.click(screen.getByRole("button", { name: "Set Balance" }))

    await waitFor(() => expect(mockCreateTrns).toHaveBeenCalled())
    const trn = mockCreateTrns.mock.calls[0][0].data[0]
    expect(trn.quantity).toBe(35)
    expect(trn.subAccounts).toEqual({ OA: 15, SA: 20 })
  })

  it("surfaces the server message when the write is rejected", async () => {
    const user = userEvent.setup()
    mockBackend({ balance: 0, portfolioId: "p-1" })
    mockCreateTrns.mockResolvedValue(
      json({ message: "Balance rejected" }, false),
    )
    const { onComplete } = renderDialog()
    await screen.findByText(/Current Balance/)
    await user.type(
      screen.getByPlaceholderText("Enter the balance you want to set"),
      "5",
    )
    await user.click(screen.getByRole("button", { name: "Set Balance" }))
    expect(await screen.findByText("Balance rejected")).toBeVisible()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("needs a portfolio before it can save", async () => {
    const user = userEvent.setup()
    mockBackend({ balance: 0 })
    renderDialog()
    await screen.findByText(/Current Balance/)
    await user.type(
      screen.getByPlaceholderText("Enter the balance you want to set"),
      "5",
    )
    expect(screen.getByRole("button", { name: "Set Balance" })).toBeDisabled()
    await user.selectOptions(screen.getByRole("combobox"), "p-1")
    expect(screen.getByRole("button", { name: "Set Balance" })).toBeEnabled()
  })

  it("tolerates config and balance lookups failing", async () => {
    const err = jest.spyOn(console, "error").mockImplementation(() => {})
    mockGetAssetConfig.mockRejectedValue(new Error("no config"))
    mockGetAssetPositions.mockRejectedValue(new Error("down"))
    const { onClose } = renderDialog()
    await waitFor(() => expect(err).toHaveBeenCalled())
    expect(screen.getByText(/Current Balance/)).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).toHaveBeenCalled()
    err.mockRestore()
  })
})
