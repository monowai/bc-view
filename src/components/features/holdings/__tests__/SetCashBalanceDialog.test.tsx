import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { enableFetchMocks } from "jest-fetch-mock"
import SetCashBalanceDialog from "../SetCashBalanceDialog"
import type { Portfolio } from "types/beancounter"

enableFetchMocks()

const portfolio = {
  id: "eur-pf",
  code: "EUR",
  name: "EUR Portfolio",
  currency: { code: "EUR", name: "Euro", symbol: "€" },
} as unknown as Portfolio

function renderOpen(): void {
  const { rerender } = render(
    <SetCashBalanceDialog
      modalOpen={false}
      onClose={jest.fn()}
      portfolio={portfolio}
      currency="EUR"
      currentBalance={500}
      assetId="eur-cash-id"
      assetName="EUR Balance"
    />,
  )
  rerender(
    <SetCashBalanceDialog
      modalOpen={true}
      onClose={jest.fn()}
      portfolio={portfolio}
      currency="EUR"
      currentBalance={500}
      assetId="eur-cash-id"
      assetName="EUR Balance"
    />,
  )
}

async function submitTarget(target: string): Promise<void> {
  renderOpen()
  await userEvent.type(screen.getByPlaceholderText("500.00"), target)
  await userEvent.click(screen.getByRole("button", { name: /Proceed/i }))
}

beforeEach(() => {
  fetchMock.resetMocks()
})

/**
 * Setting a cash balance used to publish a row to the async import topic, so a
 * server-side rejection was acked away and the dialog reported success (#1067).
 * The write has to go through the synchronous trn endpoint, where the caller sees
 * the failure.
 */
describe("SetCashBalanceDialog", () => {
  it("writes the adjustment synchronously, not onto the import topic", async () => {
    fetchMock.mockResponse(JSON.stringify({ data: { trns: [] } }))

    await submitTarget("1500")

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/trns")

    const body = JSON.parse(String(init?.body))
    expect(body.portfolioId).toBe(portfolio.id)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      assetId: "eur-cash-id",
      trnType: "DEPOSIT",
      quantity: 1000,
      cashAmount: 1000,
      tradeCurrency: "EUR",
      cashCurrency: "EUR",
      status: "SETTLED",
    })
  })

  it("withdraws when the target is below the current balance", async () => {
    fetchMock.mockResponse(JSON.stringify({ data: { trns: [] } }))

    await submitTarget("200")

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.data[0]).toMatchObject({
      trnType: "WITHDRAWAL",
      quantity: 300,
      cashAmount: 300,
    })
  })

  it("shows the server's rejection instead of reporting success", async () => {
    fetchMock.mockResponse(
      JSON.stringify({ message: "Rejecting the forward dated trade date" }),
      { status: 400 },
    )

    await submitTarget("1500")

    expect(
      await screen.findByText(/Rejecting the forward dated trade date/i),
    ).toBeInTheDocument()
    expect(screen.queryByText("Success")).not.toBeInTheDocument()
  })
})
