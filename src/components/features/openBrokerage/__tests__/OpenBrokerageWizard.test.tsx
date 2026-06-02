import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { enableFetchMocks } from "jest-fetch-mock"
import OpenBrokerageWizard from "../OpenBrokerageWizard"
import type { Broker, Portfolio } from "types/beancounter"

enableFetchMocks()

const existingBrokers: Broker[] = [
  { id: "broker-ibkr", name: "Interactive Brokers" },
  { id: "broker-dbs", name: "DBS Vickers" },
]

const existingPortfolios: Pick<Portfolio, "id" | "code" | "name" | "currency">[] =
  [
    {
      id: "src-pf",
      code: "SAVINGS",
      name: "Savings",
      currency: { code: "USD", name: "US Dollar", symbol: "$" },
    },
  ]

function mockEndpoints(): void {
  fetchMock.mockResponse((req) => Promise.resolve(handleMock(req)))
}

function handleMock(req: Request): string {
    const url = req.url
    if (url.includes("/api/brokers") && req.method === "GET") {
      return JSON.stringify({ data: existingBrokers })
    }
    if (url.includes("/api/portfolios") && req.method === "GET") {
      return JSON.stringify({ data: existingPortfolios })
    }
    if (url.includes("/api/brokers") && req.method === "POST") {
      return JSON.stringify({
        data: { id: "broker-new", name: "New Broker" },
      })
    }
    if (url.includes("/api/portfolios") && req.method === "POST") {
      return JSON.stringify({
        data: [
          {
            id: "pf-new",
            code: "IBKR",
            name: "IBKR USD",
            currency: { code: "USD" },
            base: { code: "USD" },
          },
        ],
      })
    }
    if (url.includes("/api/assets") && req.method === "POST") {
      return JSON.stringify({
        data: { USD: { id: "asset-cash-usd", code: "USD" } },
      })
    }
    if (url.includes("/api/trns") && req.method === "POST") {
      return JSON.stringify({ data: { trns: [{ id: "trn-1" }] } })
    }
    return JSON.stringify({})
}

describe("<OpenBrokerageWizard />", () => {
  beforeEach(() => {
    fetchMock.resetMocks()
    mockEndpoints()
  })

  test("renders the Broker step first", async () => {
    render(<OpenBrokerageWizard />)
    expect(
      await screen.findByRole("heading", { name: /Pick a broker|Broker/i }),
    ).toBeInTheDocument()
  })

  test("advances Broker → Portfolio → Funding → Review → Submit", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)

    // Step 1 — broker: create new
    await screen.findByRole("heading", { name: /Broker/i })
    await user.click(screen.getByRole("radio", { name: /Create a new broker/i }))
    await user.type(
      screen.getByLabelText(/Broker name/i),
      "Interactive Brokers",
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 2 — portfolio: fill code + currency
    await screen.findByRole("heading", { name: /Portfolio/i })
    await user.type(screen.getByLabelText(/Portfolio code/i), "IBKR")
    await user.type(screen.getByLabelText(/Portfolio name/i), "IBKR USD")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — funding: skip
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.click(screen.getByRole("button", { name: /Skip|No deposit/i }))

    // Step 4 — review
    await screen.findByRole("heading", { name: /Review/i })
    expect(screen.getByText(/Interactive Brokers/)).toBeInTheDocument()
    expect(screen.getByText(/IBKR/)).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /Create|Confirm|Open Brokerage/i }),
    )

    // Step 5 — done
    await screen.findByRole("heading", { name: /Done|Complete|Success/i })

    // Verify orchestration calls
    const calls = fetchMock.mock.calls.map((c) => ({
      url: c[0] as string,
      method: (c[1] as RequestInit | undefined)?.method ?? "GET",
    }))
    const posts = calls.filter((c) => c.method === "POST")
    expect(posts.some((c) => c.url.includes("/api/brokers"))).toBe(true)
    expect(posts.some((c) => c.url.includes("/api/portfolios"))).toBe(true)
    // No trn posted because user skipped funding
    expect(posts.some((c) => c.url.includes("/api/trns"))).toBe(false)
  })

  test("posts DEPOSIT + WITHDRAWAL pair when user funds from a source portfolio", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)

    // Step 1 — broker: create new (existing-broker selection has its own test)
    await screen.findByRole("heading", { name: /Broker/i })
    await user.type(screen.getByLabelText(/Broker name/i), "IBKR")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 2 — portfolio
    await screen.findByRole("heading", { name: /Portfolio/i })
    await user.type(screen.getByLabelText(/Portfolio code/i), "IBKR")
    await user.type(screen.getByLabelText(/Portfolio name/i), "IBKR USD")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — funding: enter amount + source
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.type(screen.getByLabelText(/Amount/i), "5000")
    await user.selectOptions(
      screen.getByLabelText(/Source portfolio/i),
      "src-pf",
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 4 — review
    await screen.findByRole("heading", { name: /Review/i })
    await user.click(
      screen.getByRole("button", { name: /Create|Confirm|Open Brokerage/i }),
    )

    await screen.findByRole("heading", { name: /Done|Complete|Success/i })

    // Two trn POSTs expected (WITHDRAWAL + DEPOSIT)
    const trnPosts = fetchMock.mock.calls.filter((c) => {
      const url = c[0] as string
      const method = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return method === "POST" && url.includes("/api/trns")
    })
    expect(trnPosts.length).toBeGreaterThanOrEqual(2)

    // Inspect trn bodies for the type pair
    const bodies = trnPosts.map((c) =>
      JSON.parse((c[1] as RequestInit).body as string),
    )
    const types = bodies.flatMap((b) => b.data.map((d: { trnType: string }) => d.trnType))
    expect(types).toContain("DEPOSIT")
    expect(types).toContain("WITHDRAWAL")
  })

  test("blocks Next on Portfolio step when code is empty", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)
    await screen.findByRole("heading", { name: /Broker/i })
    await user.click(screen.getByRole("radio", { name: /Create a new broker/i }))
    await user.type(screen.getByLabelText(/Broker name/i), "Test Broker")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Portfolio step — Next button disabled while code empty
    await screen.findByRole("heading", { name: /Portfolio/i })
    const nextBtn = screen.getByRole("button", { name: /Next|Continue/i })
    expect(nextBtn).toBeDisabled()
  })
})
