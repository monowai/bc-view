import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    query: {},
    isReady: true,
  }),
}))

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))

import useSWR from "swr"
import ProposedTransactions from "@pages/trns/proposed"

const brokers = [
  { id: "b1", name: "Saxo" },
  { id: "b2", name: "SCB" },
]

const makeTrn = (
  id: string,
  assetCode: string,
  broker: { id: string; name: string },
): Record<string, unknown> => ({
  id,
  trnType: "BUY",
  status: "PROPOSED",
  quantity: 10,
  price: 5,
  fees: 0,
  tradeDate: "2026-07-08",
  tradeCurrency: { code: "USD" },
  portfolio: { id: "p1", code: "PF1", name: "Portfolio 1" },
  asset: {
    id: `asset-${assetCode}`,
    code: assetCode,
    name: `${assetCode} Inc`,
    market: { code: "NYSE" },
  },
  broker,
})

const proposedData = {
  data: [makeTrn("t1", "AAA", brokers[0]), makeTrn("t2", "BBB", brokers[1])],
}

describe("Proposed Transactions broker filter", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
  })

  beforeEach(() => {
    sessionStorage.clear()
    ;(useSWR as jest.Mock).mockImplementation((key: string | null) => {
      if (typeof key === "string" && key.startsWith("/api/trns/proposed")) {
        return { data: proposedData, error: undefined, mutate: jest.fn() }
      }
      if (key === "/api/brokers") {
        return { data: { data: brokers }, error: undefined, mutate: jest.fn() }
      }
      return { data: undefined, error: undefined, mutate: jest.fn() }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("filters visible rows by broker without editing transactions", async () => {
    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("AAA")).toBeInTheDocument()
    })
    expect(screen.getByText("BBB")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Broker filter"), {
      target: { value: "b1" },
    })

    expect(screen.getByText("AAA")).toBeInTheDocument()
    expect(screen.queryByText("BBB")).not.toBeInTheDocument()

    // Filtering is display-only: nothing becomes an unsaved edit
    expect(
      screen.queryByText("You have unsaved changes"),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("no longer offers bulk apply-broker", async () => {
    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("AAA")).toBeInTheDocument()
    })
    expect(screen.queryByText("Apply broker")).not.toBeInTheDocument()
  })
})
