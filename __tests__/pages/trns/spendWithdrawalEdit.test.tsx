import React from "react"
import { render, screen } from "@testing-library/react"
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

const trn = (provider: string): object => ({
  id: "t1",
  callerRef: { provider, batch: "2026-11", callerId: "c1" },
  trnType: "WITHDRAWAL",
  status: "SETTLED",
  tradeDate: "2026-11-20",
  portfolio: { id: "p1", code: "SGD" },
  asset: { id: "dbs", code: "DBS", name: "DBS", market: { code: "PRIVATE" } },
})

const serve = (data: object): void => {
  ;(useSWR as jest.Mock).mockReturnValue({
    data: { data: [data] },
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  })
}

describe("editing a spend withdrawal", () => {
  it("opens the spend log for its month instead of the trade form", () => {
    serve(trn("SPEND"))
    render(<Trades />)
    expect(screen.getByText("spend log 2026-11")).toBeInTheDocument()
    expect(screen.queryByText("trade form")).not.toBeInTheDocument()
  })

  it("edits any other transaction in the trade form", () => {
    serve(trn("BC"))
    render(<Trades />)
    expect(screen.getByText("trade form")).toBeInTheDocument()
    expect(screen.queryByText(/spend log/)).not.toBeInTheDocument()
  })
})
