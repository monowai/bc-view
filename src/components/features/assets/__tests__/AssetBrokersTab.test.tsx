import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import AssetBrokersTab from "../AssetBrokersTab"
import { AssetBrokerHoldingsResponse } from "types/beancounter"

const mockMutate = jest.fn()
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  useSWRConfig: () => ({ mutate: mockMutate }),
}))

import useSWR from "swr"

let capturedDialogProps: Record<string, unknown> | null = null
jest.mock("@components/features/brokers/WeightedSellDialog", () => {
  return function WeightedSellDialog(props: Record<string, unknown>) {
    capturedDialogProps = props
    return <div data-testid="weighted-sell-dialog" />
  }
})

const response: AssetBrokerHoldingsResponse = {
  data: [
    {
      brokerId: "broker-1",
      brokerName: "Interactive Brokers",
      holding: {
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
        ],
      },
    },
    {
      brokerId: "NO_BROKER",
      brokerName: "Unassigned",
      holding: {
        assetId: "asset-1",
        assetCode: "VOO",
        market: "US",
        quantity: 10,
        portfolioGroups: [
          {
            portfolioId: "pf-3",
            portfolioCode: "SPARE",
            quantity: 10,
            transactions: [],
          },
        ],
      },
    },
  ],
}

describe("AssetBrokersTab", () => {
  beforeEach(() => {
    capturedDialogProps = null
    mockMutate.mockClear()
    ;(useSWR as unknown as jest.Mock).mockReturnValue({
      data: response,
      isLoading: false,
    })
  })

  it("renders a row per broker holding from the fetched data", () => {
    render(<AssetBrokersTab assetId="asset-1" />)

    expect(screen.getByText("Interactive Brokers")).toBeInTheDocument()
    expect(screen.getByText("175")).toBeInTheDocument()
    expect(screen.getByText("GROWTH, INCOME")).toBeInTheDocument()
    expect(screen.getByText("Unassigned")).toBeInTheDocument()
  })

  it("shows a loading state while fetching", () => {
    ;(useSWR as unknown as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    render(<AssetBrokersTab assetId="asset-1" />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("shows an empty state when no brokers hold the asset", () => {
    ;(useSWR as unknown as jest.Mock).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    render(<AssetBrokersTab assetId="asset-1" />)
    expect(
      screen.getByText("This asset is not held at any broker"),
    ).toBeInTheDocument()
  })

  it("opens WeightedSellDialog with the right broker/holding when Sell is clicked", () => {
    render(<AssetBrokersTab assetId="asset-1" />)

    const sellButtons = screen.getAllByRole("button", { name: /sell/i })
    fireEvent.click(sellButtons[0])

    expect(screen.getByTestId("weighted-sell-dialog")).toBeInTheDocument()
    expect(capturedDialogProps?.brokerId).toBe("broker-1")
    expect(capturedDialogProps?.brokerName).toBe("Interactive Brokers")
    expect(capturedDialogProps?.holding).toEqual(response.data[0].holding)
  })

  it("disables Sell for the NO_BROKER row", () => {
    render(<AssetBrokersTab assetId="asset-1" />)

    const sellButtons = screen.getAllByRole("button", { name: /sell/i })
    // Second row is NO_BROKER
    expect(sellButtons[1]).toBeDisabled()
  })

  it("revalidates the brokers key (does not close dialog) on submit", async () => {
    render(<AssetBrokersTab assetId="asset-1" />)

    const sellButtons = screen.getAllByRole("button", { name: /sell/i })
    fireEvent.click(sellButtons[0])

    const onSubmitted = capturedDialogProps?.onSubmitted as () => void
    onSubmitted()

    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith("/api/assets/asset-1/brokers"),
    )
    // Dialog stays mounted/open — caller only clears state via onClose.
    expect(screen.getByTestId("weighted-sell-dialog")).toBeInTheDocument()
  })
})
