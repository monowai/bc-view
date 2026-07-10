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

jest.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: () => ({
    user: { email: "test@example.com", sub: "auth0|test" },
    error: null,
    isLoading: false,
  }),
  withPageAuthRequired: (Component: React.ComponentType) => Component,
}))

jest.mock("@lib/csvExport", () => ({
  ...jest.requireActual("@lib/csvExport"),
  downloadCsv: jest.fn(),
}))

import useSWR from "swr"
import { downloadCsv } from "@lib/csvExport"
import ProposedTransactions from "@pages/trns/proposed"

const brokers = [
  { id: "b1", name: "Saxo" },
  { id: "b2", name: "SCB" },
]

const makeTrn = (
  id: string,
  assetCode: string,
  broker: { id: string; name: string },
  trnType = "BUY",
  price = 5,
): Record<string, unknown> => ({
  id,
  trnType,
  status: "PROPOSED",
  quantity: 10,
  price,
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

const mockSwr = (trns: Record<string, unknown>[]): void => {
  // Stable response objects: the page compares data identity between renders,
  // so returning a fresh object per call would loop it forever.
  const proposed = { data: { data: trns }, error: undefined, mutate: jest.fn() }
  const brokerData = {
    data: { data: brokers },
    error: undefined,
    mutate: jest.fn(),
  }
  const empty = { data: undefined, error: undefined, mutate: jest.fn() }
  ;(useSWR as jest.Mock).mockImplementation((key: string | null) => {
    if (typeof key === "string" && key.startsWith("/api/trns/proposed")) {
      return proposed
    }
    if (key === "/api/brokers") {
      return brokerData
    }
    return empty
  })
}

describe("Proposed Transactions IBKR basket export", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
  })

  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("downloads the filtered BUY/SELL trns as an IBKR basket CSV", async () => {
    mockSwr([
      makeTrn("t1", "AAA", brokers[0], "BUY", 5),
      makeTrn("t2", "BBB", brokers[1], "SELL", 7),
      makeTrn("t3", "CCC", brokers[0], "DIVI", 1),
    ])
    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("AAA")).toBeInTheDocument()
    })

    const exportButton = screen.getByRole("button", {
      name: /export ibkr basket/i,
    })
    expect(exportButton).toBeEnabled()
    fireEvent.click(exportButton)

    expect(downloadCsv).toHaveBeenCalledTimes(1)
    const [filename, csv] = (downloadCsv as jest.Mock).mock.calls[0]
    expect(filename).toMatch(/^ibkr-basket-\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = (csv as string).split("\n")
    expect(lines[0]).toBe(
      "Action,Quantity,Symbol,SecType,Exchange,Currency,TimeInForce,OrderType,LmtPrice,BasketTag",
    )
    // Only the BUY and SELL rows — DIVI is skipped
    expect(lines).toHaveLength(3)
    expect(csv).toContain("BUY,10,AAA,STK,SMART,USD,DAY,LMT,5,BC-t1")
    expect(csv).toContain("SELL,10,BBB,STK,SMART,USD,DAY,LMT,7,BC-t2")
    expect(csv).not.toContain("CCC")
  })

  it("respects the broker filter when exporting", async () => {
    mockSwr([
      makeTrn("t1", "AAA", brokers[0], "BUY"),
      makeTrn("t2", "BBB", brokers[1], "SELL"),
    ])
    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("AAA")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText("Broker filter"), {
      target: { value: "b1" },
    })
    fireEvent.click(screen.getByRole("button", { name: /export ibkr basket/i }))

    const [, csv] = (downloadCsv as jest.Mock).mock.calls[0]
    expect(csv).toContain("AAA")
    expect(csv).not.toContain("BBB")
  })

  it("is disabled when there are no exportable BUY/SELL trns", async () => {
    mockSwr([makeTrn("t1", "DDD", brokers[0], "DIVI")])
    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("DDD")).toBeInTheDocument()
    })

    const exportButton = screen.getByRole("button", {
      name: /export ibkr basket/i,
    })
    expect(exportButton).toBeDisabled()
    fireEvent.click(exportButton)
    expect(downloadCsv).not.toHaveBeenCalled()
  })
})
