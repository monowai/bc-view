import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import WeightedSellDialog from "@components/features/brokers/WeightedSellDialog"
import { BrokerHoldingPosition } from "types/beancounter"

const holding: BrokerHoldingPosition = {
  assetId: "asset-1",
  assetCode: "VOO",
  assetName: "Vanguard S&P 500",
  market: "US",
  quantity: 175,
  portfolioGroups: [
    {
      portfolioId: "pf-1",
      portfolioCode: "GROWTH",
      quantity: 100,
      transactions: [],
    },
    {
      portfolioId: "pf-2",
      portfolioCode: "INCOME",
      quantity: 75,
      transactions: [],
    },
    {
      // Excluded from preview: non-positive holding at this broker
      portfolioId: "pf-3",
      portfolioCode: "ZERO",
      quantity: 0,
      transactions: [],
    },
  ],
}

const priceResponse = {
  ok: true,
  json: () => Promise.resolve({ data: [{ close: 420.5 }] }),
}

describe("WeightedSellDialog", () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(priceResponse) as unknown as typeof fetch
  })

  it("renders per-portfolio preview rows, excluding zero/negative groups", async () => {
    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={holding}
        onSubmitted={jest.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText("GROWTH")).toBeInTheDocument())
    expect(screen.getByText("INCOME")).toBeInTheDocument()
    expect(screen.queryByText("ZERO")).not.toBeInTheDocument()
  })

  it("computes sell quantities for 50% correctly", async () => {
    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={holding}
        onSubmitted={jest.fn()}
      />,
    )

    // Price prefilled asynchronously from /api/prices
    await waitFor(() =>
      expect(screen.getByLabelText("Price")).toHaveValue(420.5),
    )

    // Default percent is 50 -> 100 * 0.5 = 50, 75 * 0.5 = 37.5
    expect(screen.getByText("50")).toBeInTheDocument()
    expect(screen.getByText("37.5")).toBeInTheDocument()
  })

  it("POSTs the propose contract on submit", async () => {
    const onSubmitted = jest.fn()
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith("/api/prices")) return Promise.resolve(priceResponse)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    })

    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={holding}
        onSubmitted={onSubmitted}
      />,
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Price")).toHaveValue(420.5),
    )

    fireEvent.click(screen.getByRole("button", { name: /propose 2 sells/i }))

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())

    const proposeCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => url === "/api/trns/broker/broker-1/propose",
    )
    expect(proposeCall).toBeDefined()
    const [, init] = proposeCall as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({
      assetId: "asset-1",
      trnType: "SELL",
      weight: 0.5,
      price: 420.5,
      tradeDate: expect.any(String),
    })
  })

  it("disables submit when percent is blank or zero", async () => {
    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={holding}
        onSubmitted={jest.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Price")).toHaveValue(420.5),
    )

    const percentInput = screen.getByLabelText("Percent to sell")
    fireEvent.change(percentInput, { target: { value: "" } })
    expect(screen.getByRole("button", { name: /propose/i })).toBeDisabled()

    fireEvent.change(percentInput, { target: { value: "0" } })
    expect(screen.getByRole("button", { name: /propose/i })).toBeDisabled()
  })

  it("disables submit when price is zero or negative", async () => {
    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={holding}
        onSubmitted={jest.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Price")).toHaveValue(420.5),
    )

    const priceInput = screen.getByLabelText("Price")
    fireEvent.change(priceInput, { target: { value: "0" } })
    expect(screen.getByRole("button", { name: /propose/i })).toBeDisabled()
  })

  it("shows an error and keeps the dialog open when the POST fails", async () => {
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith("/api/prices")) return Promise.resolve(priceResponse)
      return Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Rejected for NO_BROKER" }),
      })
    })

    const onClose = jest.fn()
    render(
      <WeightedSellDialog
        open={true}
        onClose={onClose}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={holding}
        onSubmitted={jest.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Price")).toHaveValue(420.5),
    )

    fireEvent.click(screen.getByRole("button", { name: /propose 2 sells/i }))

    await waitFor(() =>
      expect(screen.getByText("Rejected for NO_BROKER")).toBeInTheDocument(),
    )
    expect(onClose).not.toHaveBeenCalled()
  })
})
