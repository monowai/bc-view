import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { enableFetchMocks } from "jest-fetch-mock"
import CashTransferDialog from "../CashTransferDialog"
import type { CashTransferData, Portfolio } from "types/beancounter"

enableFetchMocks()

const portfolios = [
  {
    id: "sgd-pf",
    code: "SGD",
    name: "SGD Portfolio",
    currency: { code: "SGD", name: "Singapore Dollar", symbol: "$" },
  },
] as unknown as Portfolio[]

// IB-SGD broker cash line + the DBS source, both SGD ACCOUNT assets. Currency
// resolves via accountingType (priceSymbol is null for private assets).
const accountAssets = {
  "ib-sgd": {
    id: "ib-sgd-id",
    code: "owner.INTERACTIVE BROKERS-SGD",
    name: "Interactive Brokers SGD Balance",
    accountingType: { currency: { code: "SGD" } },
  },
  dbs: {
    id: "dbs-id",
    code: "owner.DBS",
    name: "DBS",
    accountingType: { currency: { code: "SGD" } },
  },
}

function mockEndpoints(): void {
  fetchMock.mockResponse((req) => {
    const url = req.url
    if (url.includes("/api/assets") && url.includes("ACCOUNT")) {
      return Promise.resolve(JSON.stringify({ data: accountAssets }))
    }
    if (url.includes("/api/currencies")) {
      return Promise.resolve(
        JSON.stringify({ data: [{ code: "SGD", name: "Singapore Dollar" }] }),
      )
    }
    return Promise.resolve(JSON.stringify({}))
  })
}

// Source = DBS with a healthy balance. portfolioId is intentionally empty to
// reproduce the call-site where the source portfolio id didn't reach the
// dialog (the screenshot bug: target looks picked but Transfer stays disabled).
function makeSource(portfolioId: string): CashTransferData {
  return {
    portfolioId,
    portfolioCode: "SGD",
    assetId: "dbs-id",
    assetCode: "owner.DBS",
    assetName: "DBS",
    currency: "SGD",
    currentBalance: 85000,
  }
}

// The open-reset (which seeds the amounts from the balance) only runs when
// modalOpen *toggles*, so mount closed then open.
function renderOpen(source: CashTransferData): void {
  const { rerender } = render(
    <CashTransferDialog
      modalOpen={false}
      onClose={() => {}}
      sourceData={source}
      portfolios={portfolios}
    />,
  )
  rerender(
    <CashTransferDialog
      modalOpen
      onClose={() => {}}
      sourceData={source}
      portfolios={portfolios}
    />,
  )
}

describe("CashTransferDialog target step", () => {
  beforeEach(() => {
    fetchMock.resetMocks()
    mockEndpoints()
  })

  test("renders a placeholder for an empty target portfolio so it isn't silently unselected", async () => {
    const user = userEvent.setup()
    renderOpen(makeSource(""))

    // Step 1 — amounts default to the full balance, so Next is enabled.
    await user.click(await screen.findByRole("button", { name: "Next" }))

    // Step 2 — target. The portfolio combobox must show the placeholder
    // (value ""), NOT silently display the only portfolio.
    const combos = await screen.findAllByRole("combobox")
    const portfolioSelect = combos[0] as HTMLSelectElement
    expect(portfolioSelect.value).toBe("")
    expect(
      screen.getByRole("option", { name: /Select target portfolio/i }),
    ).toBeInTheDocument()
  })

  test("enables Transfer once an empty-source target portfolio + asset are picked", async () => {
    const user = userEvent.setup()
    renderOpen(makeSource(""))

    await user.click(await screen.findByRole("button", { name: "Next" }))

    const transferBtn = await screen.findByRole("button", { name: "Transfer" })
    expect(transferBtn).toBeDisabled()

    const combos = await screen.findAllByRole("combobox")
    // Pick the target portfolio (a real change off the placeholder → fires
    // onChange, which the silent-display bug prevented).
    await user.selectOptions(combos[0], "sgd-pf")
    // Pick the IB-SGD target asset.
    await waitFor(() =>
      expect(
        screen.getByRole("option", {
          name: /Interactive Brokers SGD Balance/i,
        }),
      ).toBeInTheDocument(),
    )
    await user.selectOptions(combos[1], "ib-sgd-id")

    expect(transferBtn).toBeEnabled()
  })

  test("defaults amounts and target portfolio when mounted already open (conditional-render call site)", async () => {
    const user = userEvent.setup()
    // The holdings page renders `{cashTransferData && <CashTransferDialog modalOpen ...>}`,
    // so the dialog mounts with modalOpen already true — no false→true toggle.
    render(
      <CashTransferDialog
        modalOpen
        onClose={() => {}}
        sourceData={makeSource("sgd-pf")}
        portfolios={portfolios}
      />,
    )

    const nextBtn = await screen.findByRole("button", { name: "Next" })
    expect(nextBtn).toBeEnabled()
    await user.click(nextBtn)

    const combos = await screen.findAllByRole("combobox")
    expect((combos[0] as HTMLSelectElement).value).toBe("sgd-pf")
  })

  test("pre-selects a valid source portfolio so Transfer enables after only the asset is picked", async () => {
    const user = userEvent.setup()
    renderOpen(makeSource("sgd-pf"))

    await user.click(await screen.findByRole("button", { name: "Next" }))

    const combos = await screen.findAllByRole("combobox")
    expect((combos[0] as HTMLSelectElement).value).toBe("sgd-pf")
    await waitFor(() =>
      expect(
        screen.getByRole("option", {
          name: /Interactive Brokers SGD Balance/i,
        }),
      ).toBeInTheDocument(),
    )
    await user.selectOptions(combos[1], "ib-sgd-id")

    expect(screen.getByRole("button", { name: "Transfer" })).toBeEnabled()
  })
})
