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
  // Tag the wrapped component so the test can assert the page is auth-gated
  withPageAuthRequired: (Component: React.ComponentType) =>
    Object.assign(Component, { __authRequired: true }),
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
  price = 5,
): Record<string, unknown> => ({
  id,
  trnType: "BUY",
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

const proposedData = {
  data: [makeTrn("t1", "AAA", brokers[0]), makeTrn("t2", "BBB", brokers[1], 7)],
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

  it("requires authentication (page is wrapped in withPageAuthRequired)", () => {
    expect(
      (ProposedTransactions as unknown as { __authRequired?: boolean })
        .__authRequired,
    ).toBe(true)
  })

  it("keeps the broker filter visible when the filter panel is collapsed", async () => {
    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("AAA")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /filters/i }))

    // Panel content hidden, broker filter still available
    expect(screen.queryByText("Scope")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Broker filter")).toBeInTheDocument()
  })

  it("keeps edits and the toolbar when the broker filter matches nothing, and preserves edits across filtering", async () => {
    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("AAA")).toBeInTheDocument()
    })

    // Edit BBB's price, then filter it out and back
    fireEvent.change(screen.getByDisplayValue("7"), {
      target: { value: "9" },
    })
    fireEvent.change(screen.getByLabelText("Broker filter"), {
      target: { value: "b1" },
    })
    expect(screen.queryByText("BBB")).not.toBeInTheDocument()

    // Filter to a broker with no rows: toolbar (and the filter itself) must survive
    fireEvent.change(screen.getByLabelText("Broker filter"), {
      target: { value: "b2" },
    })
    expect(screen.queryByText("AAA")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Broker filter")).toBeInTheDocument()

    // Back to ALL: the edit made before filtering is still there
    fireEvent.change(screen.getByLabelText("Broker filter"), {
      target: { value: "ALL" },
    })
    expect(screen.getByDisplayValue("9")).toBeInTheDocument()
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument()
  })

  it("ignores stale stored dates unless the user explicitly changed them", async () => {
    // Simulate a previous session that merely visited the page (no explicit change)
    sessionStorage.setItem("proposed-from", JSON.stringify("2020-01-01"))
    sessionStorage.setItem("proposed-to", JSON.stringify("2020-01-03"))

    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("AAA")).toBeInTheDocument()
    })

    expect(screen.queryByDisplayValue("2020-01-01")).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("2020-01-03")).not.toBeInTheDocument()
  })

  it("honours stored dates when the user explicitly changed them", async () => {
    sessionStorage.setItem("proposed-from", JSON.stringify("2020-01-01"))
    sessionStorage.setItem("proposed-to", JSON.stringify("2020-01-03"))
    sessionStorage.setItem("proposed-dates-touched", JSON.stringify(true))

    render(<ProposedTransactions />)

    await waitFor(() => {
      expect(screen.getByText("AAA")).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue("2020-01-01")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2020-01-03")).toBeInTheDocument()
  })
})
