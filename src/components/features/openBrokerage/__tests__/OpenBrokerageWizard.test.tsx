import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { enableFetchMocks } from "jest-fetch-mock"
import { SWRConfig } from "swr"
import OpenBrokerageWizard from "../OpenBrokerageWizard"
import type { Broker, Portfolio } from "types/beancounter"

enableFetchMocks()

const existingBrokers: Broker[] = [
  { id: "broker-ibkr", name: "Interactive Brokers" },
  { id: "broker-dbs", name: "DBS Vickers" },
]

// Two portfolios so the "attach without a pick" path has a genuine unpicked
// state. The single-portfolio auto-select case overrides this per-test.
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
  {
    id: "pf-2",
    code: "GROWTH",
    name: "Growth",
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

    // Step 2 — portfolio: no inputs in new mode; code + name derive from the
    // broker name entered in step 1.
    await screen.findByRole("heading", { name: /Portfolio/i })
    // Default is Zen (attach to existing); switch to Master for a new portfolio.
    await user.click(
      screen.getByRole("radio", { name: /Create a new portfolio/i }),
    )
    expect(screen.getByText(/code BNB/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — funding: skip
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.click(screen.getByRole("button", { name: /Skip|No deposit/i }))

    // Step 4 — review
    await screen.findByRole("heading", { name: /Review/i })
    expect(screen.getByText(/Brand New Broker \(new\)/)).toBeInTheDocument()
    expect(screen.getByText(/BNB/)).toBeInTheDocument()
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

  test("posts a single DEPOSIT (no source/WITHDRAWAL leg) when an opening amount is entered", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)

    // Step 1 — broker: create new (existing-broker selection has its own test)
    await screen.findByRole("heading", { name: /Broker/i })
    await user.type(screen.getByLabelText(/Broker name/i), "IBKR")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 2 — portfolio: Master mode derives code/name from the broker
    await screen.findByRole("heading", { name: /Portfolio/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new portfolio/i }),
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — funding: nothing seeded, so add a USD account then fund it. No
    // source portfolio — the funding step no longer offers one.
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.selectOptions(
      screen.getByLabelText(/Add a currency account/i),
      "USD",
    )
    await user.type(screen.getByLabelText(/Deposit \(USD\)/i), "5000")
    expect(screen.queryByLabelText(/Source portfolio/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 4 — review
    await screen.findByRole("heading", { name: /Review/i })
    await user.click(
      screen.getByRole("button", { name: /Create|Confirm|Open Brokerage/i }),
    )

    await screen.findByRole("heading", { name: /Done|Complete|Success/i })

    // Exactly one trn POST — a DEPOSIT, no WITHDRAWAL.
    const trnPosts = fetchMock.mock.calls.filter((c) => {
      const url = c[0] as string
      const method = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return method === "POST" && url.includes("/api/trns")
    })
    const types = trnPosts
      .map((c) => JSON.parse((c[1] as RequestInit).body as string))
      .flatMap((b) => b.data.map((d: { trnType: string }) => d.trnType))
    expect(types).toContain("DEPOSIT")
    expect(types).not.toContain("WITHDRAWAL")
  })

  test("opens a zero-balance account (asset created, no DEPOSIT) when no amount is entered", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)

    // Step 1 — broker
    await screen.findByRole("heading", { name: /Broker/i })
    await user.type(screen.getByLabelText(/Broker name/i), "IBKR")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 2 — portfolio: Master mode, default currency USD
    await screen.findByRole("heading", { name: /Portfolio/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new portfolio/i }),
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — funding: add a USD account but leave it at zero, then advance
    // with Next (not Skip) so the account still opens.
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.selectOptions(
      screen.getByLabelText(/Add a currency account/i),
      "USD",
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 4 — review + submit
    await screen.findByRole("heading", { name: /Review/i })
    await user.click(
      screen.getByRole("button", { name: /Create|Confirm|Open Brokerage/i }),
    )
    await screen.findByRole("heading", { name: /Done|Complete|Success/i })

    // The cash account asset is created even with a zero opening balance...
    const assetPosts = fetchMock.mock.calls.filter((c) => {
      const url = c[0] as string
      const method = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return method === "POST" && url.includes("/api/assets")
    })
    expect(assetPosts.length).toBeGreaterThan(0)

    // ...but no DEPOSIT transaction is posted (nothing to fund).
    const trnPosts = fetchMock.mock.calls.filter((c) => {
      const url = c[0] as string
      const method = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return method === "POST" && url.includes("/api/trns")
    })
    expect(trnPosts).toHaveLength(0)
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

    // Step 2 — portfolio: Master mode derives code/name from the broker
    await screen.findByRole("heading", { name: /Portfolio/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new portfolio/i }),
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
        screen.getByRole("radio", { name: /Attach to an existing portfolio/i }),
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

    // Step 3 — funding: add a USD account + standalone deposit (no source)
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.selectOptions(
      screen.getByLabelText(/Add a currency account/i),
      "USD",
    )
    await user.type(screen.getByLabelText(/Deposit \(USD\)/i), "1000")
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

  test("opens and funds multiple currency accounts in one pass", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)

    // Step 1 — broker
    await screen.findByRole("heading", { name: /Broker/i })
    await user.type(screen.getByLabelText(/Broker name/i), "IBKR")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 2 — portfolio: Master mode, default currency USD
    await screen.findByRole("heading", { name: /Portfolio/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new portfolio/i }),
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 3 — funding: add + fund USD, then add + fund SGD
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.selectOptions(
      screen.getByLabelText(/Add a currency account/i),
      "USD",
    )
    await user.type(screen.getByLabelText(/Deposit \(USD\)/i), "5000")
    await user.selectOptions(
      screen.getByLabelText(/Add another currency account/i),
      "SGD",
    )
    await user.type(screen.getByLabelText(/Deposit \(SGD\)/i), "3000")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Step 4 — review + submit
    await screen.findByRole("heading", { name: /Review/i })
    await user.click(
      screen.getByRole("button", { name: /Create|Confirm|Open Brokerage/i }),
    )
    await screen.findByRole("heading", { name: /Done|Complete|Success/i })

    // Two DEPOSITs expected — one per currency
    const trnPosts = fetchMock.mock.calls.filter((c) => {
      const url = c[0] as string
      const method = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return method === "POST" && url.includes("/api/trns")
    })
    const depositCurrencies = trnPosts
      .map((c) => JSON.parse((c[1] as RequestInit).body as string))
      .flatMap((b) => b.data)
      .filter((d: { trnType: string }) => d.trnType === "DEPOSIT")
      .map((d: { cashCurrency: string }) => d.cashCurrency)
    expect(depositCurrencies).toContain("USD")
    expect(depositCurrencies).toContain("SGD")
  })

  test("links to the new portfolio by code, not id", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)

    await screen.findByRole("heading", { name: /Broker/i })
    await user.type(screen.getByLabelText(/Broker name/i), "IBKR")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))
    await screen.findByRole("heading", { name: /Portfolio/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new portfolio/i }),
    )
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))
    await screen.findByRole("heading", { name: /Funding|Deposit/i })
    await user.click(screen.getByRole("button", { name: /Skip|No deposit/i }))
    await screen.findByRole("heading", { name: /Review/i })
    await user.click(
      screen.getByRole("button", { name: /Create|Confirm|Open Brokerage/i }),
    )
    await screen.findByRole("heading", { name: /Done|Complete|Success/i })

    // Single-word broker → code "IBKR"; the link must use the code, never the
    // backend id "pf-new".
    const link = screen.getByRole("link", { name: /View the portfolio/i })
    expect(link).toHaveAttribute("href", "/holdings/IBKR")
  })

  test("derives the portfolio code from the broker; blocks Next only when attaching without a pick", async () => {
    const user = userEvent.setup()
    render(<OpenBrokerageWizard />)
    await screen.findByRole("heading", { name: /Broker/i })
    await user.click(
      screen.getByRole("radio", { name: /Create a new broker/i }),
    )
    await user.type(screen.getByLabelText(/Broker name/i), "Test Broker")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    await screen.findByRole("heading", { name: /Portfolio/i })
    // Master mode: code derives from the broker name → Next enabled.
    await user.click(
      screen.getByRole("radio", { name: /Create a new portfolio/i }),
    )
    expect(screen.getByText(/code TB/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Next|Continue/i }),
    ).not.toBeDisabled()

    // Switch to Zen (attach to existing) without choosing one → Next blocked.
    await user.click(
      screen.getByRole("radio", { name: /Attach to an existing portfolio/i }),
    )
    expect(
      screen.getByRole("button", { name: /Next|Continue/i }),
    ).toBeDisabled()
  })

  test("zen user with a sole portfolio folds in with no chooser", async () => {
    // Override the portfolios endpoint to return exactly one → zen + sole.
    fetchMock.resetMocks()
    const onlyPf = [
      {
        id: "only-pf",
        code: "ONLY",
        name: "Only One",
        currency: { code: "USD", name: "US Dollar", symbol: "$" },
      },
    ]
    fetchMock.mockResponse((req) => {
      if (req.url.includes("/api/portfolios") && req.method === "GET") {
        return Promise.resolve(JSON.stringify({ data: onlyPf }))
      }
      return handleMock(req)
    })

    const user = userEvent.setup()
    // Fresh SWR cache so the sole-portfolio response isn't shadowed by the
    // two-portfolio data other tests primed into the shared global cache.
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <OpenBrokerageWizard />
      </SWRConfig>,
    )

    await screen.findByRole("heading", { name: /Broker/i })
    await user.type(screen.getByLabelText(/Broker name/i), "IBKR")
    await user.click(screen.getByRole("button", { name: /Next|Continue/i }))

    // Zen user with a sole portfolio: no Zen/Master chooser, no picker — the
    // brokerage just folds into the one portfolio and Next is enabled.
    await screen.findByRole("heading", { name: /Portfolio/i })
    await waitFor(() =>
      expect(
        screen.getByText(/folds into your portfolio/i),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole("radio", { name: /Create a new portfolio/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Existing portfolio"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Next|Continue/i }),
    ).not.toBeDisabled()
  })
})
