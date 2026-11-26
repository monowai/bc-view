import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSWR from "swr"
import Trades from "@pages/trns/trades/[...trades]"

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  query: { trades: ["edit", "p1", "t1"] } as Record<string, unknown>,
  isReady: true,
}

jest.mock("next/router", () => ({ useRouter: () => mockRouter }))
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))
jest.mock("@auth0/nextjs-auth0/client", () => ({
  withPageAuthRequired: (Component: React.ComponentType) => Component,
}))
jest.mock("@components/features/wealth/SpendLogDialog", () => ({
  __esModule: true,
  default: ({ initialMonth }: { initialMonth?: string }) => (
    <div>spend log {initialMonth}</div>
  ),
}))
jest.mock("@components/features/transactions/TradeInputForm", () => ({
  __esModule: true,
  default: () => <div>trade form</div>,
}))
jest.mock("@components/features/transactions/FxEditModal", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@components/features/transactions/SubAccountTrnEditModal", () => ({
  __esModule: true,
  default: () => null,
}))

const leg = {
  id: "t1",
  callerRef: { provider: "BC-AUTO", batch: "parent-caller", callerId: "c1" },
  trnType: "WITHDRAWAL",
  status: "SETTLED",
  tradeDate: "2026-11-20",
  portfolio: { id: "p1", code: "CASH" },
  asset: { id: "usd", code: "USD", name: "USD", market: { code: "CASH" } },
}
const trade = { ...leg, id: "trade-9", trnType: "BUY", portfolio: { id: "p9" } }

type Served = { data?: object; error?: Error }

const serve = (byKey: Record<string, Served>): void => {
  ;(useSWR as jest.Mock).mockImplementation((key: string | null) => {
    const hit = key ? byKey[key] : undefined
    return {
      data: hit?.data,
      error: hit?.error,
      isLoading: false,
      mutate: jest.fn(),
    }
  })
}

beforeEach(() => jest.clearAllMocks())

describe("editing an auto-settle cash leg", () => {
  it("opens the trade it settles instead", async () => {
    serve({
      "/api/trns/t1": { data: { data: [leg] } },
      "/api/trns/settles/t1": { data: { data: [trade] } },
    })
    render(<Trades />)
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/trns/trades/edit/p9/trade-9",
      ),
    )
    expect(screen.queryByText("trade form")).not.toBeInTheDocument()
  })

  it("edits the leg itself when its trade is gone", () => {
    serve({
      "/api/trns/t1": { data: { data: [leg] } },
      "/api/trns/settles/t1": { error: new Error("404") },
    })
    render(<Trades />)
    expect(screen.getByText("trade form")).toBeInTheDocument()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it("edits the leg itself when no trade is found for it", () => {
    serve({
      "/api/trns/t1": { data: { data: [leg] } },
      "/api/trns/settles/t1": { data: { data: [] } },
    })
    render(<Trades />)
    expect(screen.getByText("trade form")).toBeInTheDocument()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it("does not look for a trade behind an ordinary transaction", () => {
    serve({
      "/api/trns/t1": {
        data: { data: [{ ...leg, callerRef: { provider: "BC" } }] },
      },
    })
    render(<Trades />)
    expect(screen.getByText("trade form")).toBeInTheDocument()
    expect(useSWR).not.toHaveBeenCalledWith(
      "/api/trns/settles/t1",
      expect.anything(),
      expect.anything(),
    )
  })
})
