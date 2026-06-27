import { enableFetchMocks } from "jest-fetch-mock"
import { openBrokerage } from "../orchestrate"

enableFetchMocks()

interface AssetPostBody {
  data?: Record<string, { market?: string; currency?: string; code?: string }>
}
interface TrnPostBody {
  data: Array<{ trnType: string; cashCurrency: string }>
}

function handleMock(req: Request): Promise<string> {
  const url = req.url
  const method = req.method
  if (url.includes("/api/brokers") && method === "GET") {
    // No existing broker by that name → ensureBroker takes the POST branch.
    return Promise.resolve(JSON.stringify({ data: [] }))
  }
  if (url.includes("/api/brokers") && method === "POST") {
    return req
      .clone()
      .json()
      .then((body: { name?: string }) =>
        JSON.stringify({
          data: { id: "broker-new", name: body.name ?? "Broker" },
        }),
      )
  }
  if (url.includes("/api/portfolios") && method === "POST") {
    return Promise.resolve(JSON.stringify({ data: [{ id: "pf-new" }] }))
  }
  if (url.includes("/api/assets") && method === "POST") {
    return req
      .clone()
      .json()
      .then((body: AssetPostBody) => {
        const code = Object.keys(body.data ?? {})[0] ?? "USD"
        return JSON.stringify({
          data: { [code]: { id: `asset-${code}`, code } },
        })
      })
  }
  if (url.includes("/api/trns") && method === "POST") {
    return Promise.resolve(
      JSON.stringify({ data: { trns: [{ id: "trn-1" }] } }),
    )
  }
  return Promise.resolve(JSON.stringify({}))
}

function trnPosts(): TrnPostBody[] {
  return fetchMock.mock.calls
    .filter((c) => {
      const url = c[0] as string
      const m = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return m === "POST" && url.includes("/api/trns")
    })
    .map((c) => JSON.parse((c[1] as RequestInit).body as string) as TrnPostBody)
}

function assetPosts(): AssetPostBody[] {
  return fetchMock.mock.calls
    .filter((c) => {
      const url = c[0] as string
      const m = (c[1] as RequestInit | undefined)?.method ?? "GET"
      return m === "POST" && url.includes("/api/assets")
    })
    .map(
      (c) => JSON.parse((c[1] as RequestInit).body as string) as AssetPostBody,
    )
}

describe("openBrokerage", () => {
  beforeEach(() => {
    fetchMock.resetMocks()
    fetchMock.mockResponse((req) => handleMock(req))
  })

  // The wizard no longer offers a source portfolio, but the onboarding flow
  // still passes one — so the DEPOSIT + matching WITHDRAWAL pair must stay
  // covered at the orchestrator level.
  test("posts a DEPOSIT + WITHDRAWAL pair when a source portfolio is given", async () => {
    const res = await openBrokerage({
      broker: { mode: "new", newName: "IBKR" },
      portfolio: {
        mode: "new",
        code: "IBKR",
        name: "IBKR Portfolio",
        currency: "USD",
        base: "USD",
      },
      funding: [{ currency: "USD", amount: 5000, sourcePortfolioId: "src-pf" }],
    })

    const types = trnPosts().flatMap((b) => b.data.map((d) => d.trnType))
    expect(types).toContain("DEPOSIT")
    expect(types).toContain("WITHDRAWAL")
    expect(res.accountIds).toHaveLength(1)
    expect(res.trnIds.length).toBeGreaterThanOrEqual(2)
  })

  // Zero-balance account, attach-to-existing mode: the per-broker PRIVATE cash
  // asset is created (so the currency bucket exists), but no DEPOSIT is posted.
  test("opens a zero-balance PRIVATE broker cash account in existing mode without a deposit", async () => {
    const res = await openBrokerage({
      broker: { mode: "new", newName: "IBKR" },
      portfolio: {
        mode: "existing",
        existingId: "pf-existing",
        code: "SAVINGS",
        currency: "USD",
      },
      funding: [{ currency: "USD", amount: 0 }],
    })

    const privateAsset = assetPosts().find(
      (b) => b.data?.["IBKR-USD"]?.market === "PRIVATE",
    )
    expect(privateAsset).toBeDefined()
    expect(res.accountIds).toHaveLength(1)
    expect(res.trnIds).toHaveLength(0)
    expect(trnPosts()).toHaveLength(0)
  })

  // The opened cash accounts become the broker's per-currency settlement
  // default (PATCH /api/brokers/{id}), so a later trade settles to the
  // broker's own cash line rather than a generic CASH/ccy.
  test("registers opened accounts as the broker's settlement default per currency", async () => {
    await openBrokerage({
      broker: { mode: "new", newName: "IBKR" },
      portfolio: {
        mode: "existing",
        existingId: "pf-existing",
        code: "SAVINGS",
        currency: "USD",
      },
      funding: [
        { currency: "USD", amount: 0 },
        { currency: "SGD", amount: 1000 },
      ],
    })

    const patch = fetchMock.mock.calls.find((c) => {
      const url = c[0] as string
      const m = (c[1] as RequestInit | undefined)?.method
      return m === "PATCH" && url.includes("/api/brokers/")
    })
    expect(patch).toBeDefined()
    const body = JSON.parse((patch![1] as RequestInit).body as string) as {
      settlementAccounts: Record<string, string>
    }
    expect(body.settlementAccounts.USD).toBe("asset-IBKR-USD")
    expect(body.settlementAccounts.SGD).toBe("asset-IBKR-SGD")
  })

  // No accounts opened → no settlement registration.
  test("does not PATCH the broker when no accounts are opened", async () => {
    await openBrokerage({
      broker: { mode: "new", newName: "IBKR" },
      portfolio: {
        mode: "new",
        code: "IBKR",
        name: "IBKR Portfolio",
        currency: "USD",
        base: "USD",
      },
    })
    const patched = fetchMock.mock.calls.some((c) => {
      const m = (c[1] as RequestInit | undefined)?.method
      return m === "PATCH" && (c[0] as string).includes("/api/brokers/")
    })
    expect(patched).toBe(false)
  })

  // Zero-balance account, new dedicated portfolio: the brokerage cash uses the
  // per-broker PRIVATE line ({brokerCode}-{ccy}) in this mode too, so the cash
  // shows as a broker-coded account regardless of which portfolio holds it.
  test("opens a zero-balance per-broker PRIVATE cash account in new mode without a deposit", async () => {
    const res = await openBrokerage({
      broker: { mode: "new", newName: "IBKR" },
      portfolio: {
        mode: "new",
        code: "IBKR",
        name: "IBKR Portfolio",
        currency: "USD",
        base: "USD",
      },
      funding: [{ currency: "USD", amount: 0 }],
    })

    const privateAsset = assetPosts().find(
      (b) => b.data?.["IBKR-USD"]?.market === "PRIVATE",
    )
    expect(privateAsset).toBeDefined()
    expect(res.accountIds).toHaveLength(1)
    expect(res.trnIds).toHaveLength(0)
  })
})
