/**
 * Orchestration for the Open Brokerage wizard. Composes existing
 * `/api/brokers`, `/api/portfolios`, `/api/assets`, and `/api/trns`
 * endpoints into a single multi-step flow. Kept separate from the
 * component so it can be unit-tested or reused.
 */

import type { Broker } from "types/beancounter"

const today = (): string => new Date().toISOString().split("T")[0]

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
  return resp.data?.trns?.[0]?.id ?? ""
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
    trnIds.push(
      await postTrn({
        portfolioId,
        trnType: "DEPOSIT",
        assetId: cashAssetId,
        currency: req.funding.currency,
        amount: req.funding.amount,
      }),
    )
  }

  return { broker, portfolioId, trnIds }
}
