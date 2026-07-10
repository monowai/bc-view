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
    // quantity === sum of groups: total is broker-scoped, no cross-broker note
    expect(screen.getByText("175")).toBeInTheDocument()
    expect(screen.queryByText(/Across all brokers/)).not.toBeInTheDocument()
  })

  it("shows broker-scoped total and labels the cross-broker figure when they differ", async () => {
    // holding.quantity spans all brokers (96); only 51 + 15 = 66 sit at this one
    const crossBroker: BrokerHoldingPosition = {
      ...holding,
      quantity: 96,
      portfolioGroups: [
        {
          portfolioId: "pf-1",
          portfolioCode: "TYLER",
          quantity: 51,
          transactions: [],
        },
        {
          portfolioId: "pf-2",
          portfolioCode: "USV",
          quantity: 15,
          transactions: [],
        },
      ],
    }
    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="IBRK"
        holding={crossBroker}
        onSubmitted={jest.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText("TYLER")).toBeInTheDocument())
    expect(screen.getByText(/Total at IBRK/)).toBeInTheDocument()
    expect(screen.getByText("66")).toBeInTheDocument()
    expect(screen.getByText("Across all brokers: 96")).toBeInTheDocument()
  })

  it("defaults 'Percent to sell' to 100", async () => {
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
      expect(screen.getByLabelText("Percent to sell")).toHaveValue(100),
    )
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

    // 50% -> 100 * 0.5 = 50, 75 * 0.5 = 37.5 which rounds to 38 under the
    // default board lot of 1 (whole shares).
    fireEvent.change(screen.getByLabelText("Percent to sell"), {
      target: { value: "50" },
    })
    expect(screen.getByText("50")).toBeInTheDocument()
    expect(screen.getByText("38")).toBeInTheDocument()
  })

  it("rounds sell quantities to whole shares by default", async () => {
    const wholeShareHolding: BrokerHoldingPosition = {
      assetId: "asset-1",
      assetCode: "VOO",
      market: "US",
      quantity: 87,
      portfolioGroups: [
        {
          portfolioId: "pf-1",
          portfolioCode: "CHAT",
          quantity: 69,
          transactions: [],
        },
        {
          portfolioId: "pf-2",
          portfolioCode: "TYLER",
          quantity: 18,
          transactions: [],
        },
      ],
    }
    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={wholeShareHolding}
        onSubmitted={jest.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Price")).toHaveValue(420.5),
    )

    fireEvent.change(screen.getByLabelText("Percent to sell"), {
      target: { value: "50" },
    })
    // 69 * 0.5 = 34.5 -> 35 (never 34.5); 18 * 0.5 = 9
    expect(screen.getByText("35")).toBeInTheDocument()
    expect(screen.queryByText("34.5")).not.toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /propose 2 sells/i }),
    ).toBeInTheDocument()
  })

  it("keeps fractional quantities when boardLot is 0", async () => {
    const fractionalHolding: BrokerHoldingPosition = {
      assetId: "asset-1",
      assetCode: "FUND",
      market: "US",
      quantity: 69,
      boardLot: 0,
      portfolioGroups: [
        {
          portfolioId: "pf-1",
          portfolioCode: "CHAT",
          quantity: 69,
          transactions: [],
        },
      ],
    }
    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={fractionalHolding}
        onSubmitted={jest.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Price")).toHaveValue(420.5),
    )

    fireEvent.change(screen.getByLabelText("Percent to sell"), {
      target: { value: "50" },
    })
    expect(screen.getByText("34.5")).toBeInTheDocument()
  })

  it("rounds to board lot multiples and mutes sub-lot rows", async () => {
    const lotHolding: BrokerHoldingPosition = {
      assetId: "asset-1",
      assetCode: "SGX1",
      market: "SG",
      quantity: 170,
      boardLot: 100,
      portfolioGroups: [
        {
          portfolioId: "pf-1",
          portfolioCode: "BIG",
          quantity: 130,
          transactions: [],
        },
        {
          portfolioId: "pf-2",
          portfolioCode: "SMALL",
          quantity: 40,
          transactions: [],
        },
      ],
    }
    render(
      <WeightedSellDialog
        open={true}
        onClose={jest.fn()}
        brokerId="broker-1"
        brokerName="Interactive Brokers"
        holding={lotHolding}
        onSubmitted={jest.fn()}
      />,
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Price")).toHaveValue(420.5),
    )

    // 130 * 0.5 = 65 -> nearest lot = 100 (<= held); 40 * 0.5 = 20 -> 0
    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByTitle("Below board lot")).toBeInTheDocument()
    // Sub-lot row is excluded from the proposal count
    expect(
      screen.getByRole("button", { name: /propose 1 sell/i }),
    ).toBeInTheDocument()

    // Every row below the lot -> nothing to propose -> disabled
    fireEvent.change(screen.getByLabelText("Percent to sell"), {
      target: { value: "10" },
    })
    expect(screen.getByRole("button", { name: /propose/i })).toBeDisabled()
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

    fireEvent.change(screen.getByLabelText("Percent to sell"), {
      target: { value: "50" },
    })
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
