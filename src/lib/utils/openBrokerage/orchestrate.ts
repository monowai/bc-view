/**
 * Orchestration for the Open Brokerage wizard. Composes existing
 * `/api/brokers`, `/api/portfolios`, `/api/assets`, and `/api/trns`
 * endpoints into a single multi-step flow. Kept separate from the
 * component so it can be unit-tested or reused.
 */

import type { Broker } from "types/beancounter"

// Local-date YYYY-MM-DD so tradeDate matches the user's calendar day,
// not UTC's. `new Date().toISOString()` would mis-report the day for any
// user east of GMT after late afternoon.
const today = (): string => {
  const d = new Date()
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`
  )
}

interface BrokerStep {
  mode: "existing" | "new"
  existingId?: string
  newName?: string
  newAccountNumber?: string
}

interface PortfolioStep {
  code: string
  name: string
  currency: string
  base: string
}

interface FundingStep {
  amount: number
  sourcePortfolioId?: string // omit → no WITHDRAWAL leg
  currency: string
}

export interface OpenBrokerageRequest {
  broker: BrokerStep
  portfolio: PortfolioStep
  funding?: FundingStep
}

export interface OpenBrokerageResult {
  broker: Broker
  portfolioId: string
  trnIds: string[]
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      data?.error || `${url} failed (${res.status} ${res.statusText})`,
    )
  }
  return (await res.json()) as T
}

async function ensureBroker(step: BrokerStep): Promise<Broker> {
  if (step.mode === "existing") {
    if (!step.existingId) throw new Error("Existing broker id required")
    return { id: step.existingId, name: "" }
  }
  if (!step.newName) throw new Error("Broker name required")
  // Reuse any existing broker with the same name so retrying the wizard
  // after a downstream failure (e.g. duplicate-portfolio-code 409) doesn't
  // collide with the backend's unique broker-name-per-owner constraint.
  const newName = step.newName
  const existing = await fetch("/api/brokers")
    .then((r) => (r.ok ? (r.json() as Promise<{ data: Broker[] }>) : null))
    .then((j) => j?.data.find((b) => b.name === newName))
    .catch(() => undefined)
  if (existing) return existing
  const resp = await postJson<{ data: Broker }>("/api/brokers", {
    name: step.newName,
    accountNumber: step.newAccountNumber || undefined,
  })
  return resp.data
}

async function createPortfolio(step: PortfolioStep): Promise<string> {
  const resp = await postJson<{ data: Array<{ id: string }> }>(
    "/api/portfolios",
    {
      data: [
        {
          code: step.code,
          name: step.name,
          currency: step.currency,
          base: step.base,
        },
      ],
    },
  )
  if (!resp.data?.[0]?.id) throw new Error("Portfolio creation returned no id")
  return resp.data[0].id
}

async function ensureCashAsset(currency: string): Promise<string> {
  const resp = await postJson<{
    data: Record<string, { id: string }>
  }>("/api/assets", {
    data: { [currency]: { market: "CASH", code: currency } },
  })
  const asset = Object.values(resp.data)[0]
  if (!asset?.id) throw new Error("Cash asset lookup returned no id")
  return asset.id
}

interface TrnLeg {
  portfolioId: string
  trnType: "DEPOSIT" | "WITHDRAWAL"
  assetId: string
  currency: string
  amount: number
}

async function postTrn(leg: TrnLeg): Promise<string> {
  const resp = await postJson<{ data: { trns?: Array<{ id: string }> } }>(
    "/api/trns",
    {
      portfolioId: leg.portfolioId,
      data: [
        {
          assetId: leg.assetId,
          cashAssetId: leg.assetId,
          trnType: leg.trnType,
          quantity: leg.amount,
          price: 1,
          tradeCurrency: leg.currency,
          cashCurrency: leg.currency,
          cashAmount: leg.amount,
          tradeDate: today(),
          status: "SETTLED",
        },
      ],
    },
  )
  // Backend returns a normalised TrnPayload envelope; the first trn id
  // is what callers care about. If the envelope is empty (shouldn't
  // happen on 2xx but observed when auto-settle reshapes the response),
  // log + return an empty string so the wizard still completes and the
  // user sees the success screen — the trn was persisted upstream.
  const id = resp.data?.trns?.[0]?.id
  if (!id) {
    console.warn("postTrn: backend returned no trn id", resp)
    return ""
  }
  return id
}

/**
 * Run the full Open Brokerage flow. Calls are sequential and stop on first
 * failure — callers should surface the thrown error in the UI. Caller is
 * responsible for confirming user intent before calling (no idempotency).
 */
export async function openBrokerage(
  req: OpenBrokerageRequest,
): Promise<OpenBrokerageResult> {
  const broker = await ensureBroker(req.broker)
  const portfolioId = await createPortfolio(req.portfolio)

  const trnIds: string[] = []
  if (req.funding && req.funding.amount > 0) {
    const cashAssetId = await ensureCashAsset(req.funding.currency)
    // Order matters: DEPOSIT first into the freshly-created portfolio
    // (always succeeds — no balance/code constraints), then WITHDRAWAL
    // from the source. If WITHDRAWAL fails afterwards the worst-case
    // state is "cash visible in both portfolios" (a duplicate the user
    // can spot and reverse), not "phantom debit on the source".
    trnIds.push(
      await postTrn({
        portfolioId,
        trnType: "DEPOSIT",
        assetId: cashAssetId,
        currency: req.funding.currency,
        amount: req.funding.amount,
      }),
    )
    if (req.funding.sourcePortfolioId) {
      trnIds.push(
        await postTrn({
          portfolioId: req.funding.sourcePortfolioId,
          trnType: "WITHDRAWAL",
          assetId: cashAssetId,
          currency: req.funding.currency,
          amount: req.funding.amount,
        }),
      )
    }
  }

  return { broker, portfolioId, trnIds }
}
