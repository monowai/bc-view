import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { enableFetchMocks } from "jest-fetch-mock"
import OpenBrokerageWizard from "../OpenBrokerageWizard"
import type { Broker, Portfolio } from "types/beancounter"

enableFetchMocks()

const existingBrokers: Broker[] = [
  { id: "broker-ibkr", name: "Interactive Brokers" },
  { id: "broker-dbs", name: "DBS Vickers" },
]

const existingPortfolios: Pick<
  Portfolio,
  "id" | "code" | "name" | "currency"
>[] = [
  {
    id: "src-pf",
    code: "SAVINGS",
    name: "Savings",
    currency: { code: "USD", name: "US Dollar", symbol: "$" },
  },
]

function mockEndpoints(): void {
  fetchMock.mockResponse((req) => handleMock(req))
}

function handleMock(req: Request): Promise<string> {
  const url = req.url
  if (url.includes("/api/brokers") && req.method === "GET") {
    return Promise.resolve(JSON.stringify({ data: existingBrokers }))
  }
  if (url.includes("/api/portfolios") && req.method === "GET") {
    return Promise.resolve(JSON.stringify({ data: existingPortfolios }))
  }
  if (url.includes("/api/brokers") && req.method === "POST") {
    // Echo the requested name so downstream broker-cash-asset codes
    // (e.g. `IBRK-USD`) match the broker the wizard just created.
    return req
      .clone()
      .json()
      .then((body: { name?: string }) =>
        JSON.stringify({
          data: { id: "broker-new", name: body.name ?? "New Broker" },
        }),
      )
  }
  if (url.includes("/api/portfolios") && req.method === "POST") {
    return Promise.resolve(
      JSON.stringify({
        data: [
          {
            id: "pf-new",
            code: "IBKR",
            name: "IBKR USD",
            currency: { code: "USD" },
            base: { code: "USD" },
          },
        ],
      }),
    )
  }
  if (url.includes("/api/assets") && req.method === "POST") {
    // Echo the requested asset key + market so tests can assert on the
    // exact code (e.g. broker-cash `IBRK-USD`, market: "PRIVATE").
    return req
      .clone()
      .json()
      .then(
        (body: {
          data?: Record<string, { market?: string; code?: string }>
        }) => {
          const code = Object.keys(body.data ?? {})[0] ?? "USD"
          return JSON.stringify({
            data: { [code]: { id: `asset-${code}`, code } },
          })
        },
      )
  }
  if (url.includes("/api/trns") && req.method === "POST") {
    return Promise.resolve(
      JSON.stringify({ data: { trns: [{ id: "trn-1" }] } }),
    )
  }
  return Promise.resolve(JSON.stringify({}))
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

    // Step 1 — broker: create new. Use a name not in the existing list so
    // ensureBroker takes the POST branch (reuse-by-name is covered below).
    await screen.findByRole("heading", { name: /Broker/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new broker/i }),
    )
    await user.type(screen.getByLabelText(/Broker name/i), "Brand New Broker")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 2 — portfolio: name only; code is derived from it.
    await screen.findByRole("heading", { name: /Portfolio/i })
    await user.type(screen.getByLabelText(/Portfolio name/i), "IBKR USD")
    expect(screen.getByText("Code: IBKRUSD")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — funding: skip
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.click(screen.getByRole("button", { name: /Skip|No deposit/i }))

    // Step 4 — review
    await screen.findByRole("heading", { name: /Review/i })
    expect(screen.getByText(/Brand New Broker/)).toBeInTheDocument()
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
    const types = bodies.flatMap((b) =>
      b.data.map((d: { trnType: string }) => d.trnType),
    )
    expect(types).toContain("DEPOSIT")
    expect(types).toContain("WITHDRAWAL")
  })

  test("reuses an existing broker by name instead of POSTing a duplicate", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)

    // Step 1 — broker: create new, but type a name that already exists
    await screen.findByRole("heading", { name: /Broker/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new broker/i }),
    )
    await user.type(
      screen.getByLabelText(/Broker name/i),
      "Interactive Brokers",
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 2 — portfolio
    await user.type(
      screen.getByLabelText(/Portfolio name/i),
      "Interactive Brokers USD",
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — skip funding
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.click(screen.getByRole("button", { name: /Skip|No deposit/i }))

    // Step 4 — review + submit
    await screen.findByRole("heading", { name: /Review/i })
    await user.click(
      screen.getByRole("button", { name: /Create|Confirm|Open Brokerage/i }),
    )
    await screen.findByRole("heading", { name: /Done|Complete|Success/i })

    // Must NOT POST a duplicate broker — only the existence-check GET happens
    const brokerPosts = fetchMock.mock.calls.filter((c) => {
      const url = c[0] as string
      const method = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return method === "POST" && url.includes("/api/brokers")
    })
    expect(brokerPosts).toHaveLength(0)
  })

  test("attaches to an existing portfolio with a per-broker PRIVATE cash asset", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)

    // Step 1 — broker
    await screen.findByRole("heading", { name: /Broker/i })
    await user.type(screen.getByLabelText(/Broker name/i), "IBRK")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 2 — pick existing portfolio (wait for SWR to populate the list
    // so the radio is enabled)
    await screen.findByRole("heading", { name: /Portfolio/i })
    await waitFor(() =>
      expect(
        screen.getByRole("radio", {
          name: /Attach to an existing portfolio/i,
        }),
      ).not.toBeDisabled(),
    )
    await user.click(
      screen.getByRole("radio", { name: /Attach to an existing portfolio/i }),
    )
    await user.selectOptions(
      await screen.findByLabelText("Existing portfolio"),
      "src-pf",
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — funding: standalone deposit (no source)
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.type(screen.getByLabelText(/Amount/i), "1000")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 4 — review + submit
    await screen.findByRole("heading", { name: /Review/i })
    await user.click(
      screen.getByRole("button", { name: /Create|Confirm|Open Brokerage/i }),
    )
    await screen.findByRole("heading", { name: /Done|Complete|Success/i })

    // No POST /api/portfolios (we attached to an existing one)
    const portfolioPosts = fetchMock.mock.calls.filter((c) => {
      const url = c[0] as string
      const method = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return method === "POST" && url.includes("/api/portfolios")
    })
    expect(portfolioPosts).toHaveLength(0)

    // POST /api/assets must request a PRIVATE asset coded `IBRK-USD`
    const assetPosts = fetchMock.mock.calls.filter((c) => {
      const url = c[0] as string
      const method = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return method === "POST" && url.includes("/api/assets")
    })
    expect(assetPosts.length).toBeGreaterThan(0)
    const assetBodies = assetPosts.map((c) =>
      JSON.parse((c[1] as RequestInit).body as string),
    )
    const brokerCashAsset = assetBodies.find(
      (b) => b.data?.["IBRK-USD"]?.market === "PRIVATE",
    )
    expect(brokerCashAsset).toBeDefined()
  })

  test("blocks Next on Portfolio step when code is empty", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)
    await screen.findByRole("heading", { name: /Broker/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new broker/i }),
    )
    await user.type(screen.getByLabelText(/Broker name/i), "Test Broker")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Portfolio step — Next button disabled while code empty
    await screen.findByRole("heading", { name: /Portfolio/i })
    const nextBtn = screen.getByRole("button", { name: /Next|Continue/i })
    expect(nextBtn).toBeDisabled()
  })
})
