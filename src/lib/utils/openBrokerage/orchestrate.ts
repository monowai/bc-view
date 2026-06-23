/**
 * Orchestration for the Open Brokerage wizard. Composes existing
 * `/api/brokers`, `/api/portfolios`, `/api/assets`, and `/api/trns`
 * endpoints into a single multi-step flow. Kept separate from the
 * component so it can be unit-tested or reused.
 */

import type { Broker } from "types/beancounter"
import { deriveBrokerCode } from "@lib/openBrokerage/brokerCode"

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
  mode: "new" | "existing"
  // Required when mode === "new". `currency` is the portfolio's default
  // (reporting/base) currency.
  code?: string
  name?: string
  currency: string
  base?: string
  // Required when mode === "existing". `code` lets the orchestrator return a
  // portfolioCode for navigation without a round-trip to look it up.
  existingId?: string
}

// One currency account to open in the brokerage, with its opening deposit.
// The wizard collects a list of these so a brokerage can be funded across
// several currencies in a single pass (e.g. an IB account holding USD + SGD).
interface FundingAccount {
  currency: string
  amount: number
  // Either source side may be omitted (no WITHDRAWAL leg = standalone
  // deposit). When both are given, sourceAssetId takes precedence — use it
  // when the source is a specific PRIVATE asset (e.g. a bank-account line in
  // the same portfolio); fall back to ensureCashAsset(currency) when only
  // sourcePortfolioId is set.
  sourcePortfolioId?: string
  sourceAssetId?: string
}

export interface OpenBrokerageRequest {
  broker: BrokerStep
  portfolio: PortfolioStep
  funding?: FundingAccount[]
}

export interface OpenBrokerageResult {
  broker: Broker
  portfolioId: string
  // Portfolio CODE (not id) — callers navigate to /holdings/{code}.
  portfolioCode: string
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
    // Resolve the broker's name so the per-broker cash asset code
    // (deriveBrokerCode(name)) is correct for existing brokers too — without
    // this the code would collapse to "-{ccy}" on the existing-broker path.
    const existingId = step.existingId
    const found = await fetch("/api/brokers")
      .then((r) => (r.ok ? (r.json() as Promise<{ data: Broker[] }>) : null))
      .then((j) => j?.data.find((b) => b.id === existingId))
      .catch(() => undefined)
    // Fail fast rather than degrade to an empty name: an empty name collapses
    // the per-broker cash code to "-{ccy}", which two unresolved brokers would
    // then share, mixing their balances.
    if (!found) throw new Error("Could not resolve the selected broker")
    return found
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

async function resolvePortfolio(
  step: PortfolioStep,
): Promise<{ id: string; code: string }> {
  if (step.mode === "existing") {
    if (!step.existingId) throw new Error("Existing portfolio id required")
    return { id: step.existingId, code: step.code ?? "" }
  }
  if (!step.code || !step.name || !step.base) {
    throw new Error("New portfolio requires code, name and base currency")
  }
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
  return { id: resp.data[0].id, code: step.code }
}

async function ensureAsset(payload: {
  code: string
  market: string
  name?: string
  currency?: string
  category?: string
}): Promise<string> {
  const resp = await postJson<{
    data: Record<string, { id: string }>
  }>("/api/assets", {
    data: { [payload.code]: payload },
  })
  const asset = Object.values(resp.data)[0]
  if (!asset?.id)
    throw new Error(`Asset lookup returned no id (${payload.code})`)
  return asset.id
}

// Generic CASH/{ccy} asset (e.g. CASH/USD = "USD Balance"). Used when the
// brokerage gets its own dedicated portfolio — no need to disambiguate
// cash buckets within a single portfolio.
const ensureCashAsset = (currency: string): Promise<string> =>
  ensureAsset({ code: currency, market: "CASH" })

// Per-broker PRIVATE cash asset like "IB-USD" / "CS-SGD". Used when the
// brokerage attaches to an EXISTING portfolio so the broker's cash is
// visible as a distinct line ("Interactive Brokers USD Balance") alongside
// any pre-existing generic-cash holdings in the same portfolio. The CODE is
// the abbreviated broker code (deriveBrokerCode) so it stays compact; the
// display NAME keeps the full broker name. PRIVATE assets MUST carry an
// explicit `currency` and `category` per svc-data's AssetController
// validation ("Currency required for private asset {code}").
const ensureBrokerCashAsset = (
  brokerCode: string,
  brokerName: string,
  currency: string,
): Promise<string> =>
  ensureAsset({
    code: `${brokerCode}-${currency}`,
    market: "PRIVATE",
    name: `${brokerName} ${currency} Balance`,
    currency,
    category: "ACCOUNT",
  })

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
  const { id: portfolioId, code: portfolioCode } = await resolvePortfolio(
    req.portfolio,
  )
  const brokerCode = deriveBrokerCode(broker.name)

  // Each funded currency account is opened independently so a single pass can
  // span several currencies (e.g. an IB account holding USD + SGD). Sequential
  // — see the function doc on idempotency.
  const trnIds: string[] = []
  for (const account of req.funding ?? []) {
    if (account.amount <= 0) continue
    // Attach-to-existing-portfolio path uses a per-broker PRIVATE cash asset
    // so the brokerage cash is visible as a distinct line in the existing
    // portfolio's holdings; the new-portfolio path uses the generic
    // per-currency CASH asset (the portfolio itself segregates).
    const depositAssetId =
      req.portfolio.mode === "existing"
        ? await ensureBrokerCashAsset(brokerCode, broker.name, account.currency)
        : await ensureCashAsset(account.currency)
    // Order matters: DEPOSIT first into the freshly-created portfolio
    // (always succeeds — no balance/code constraints), then WITHDRAWAL
    // from the source. If WITHDRAWAL fails afterwards the worst-case
    // state is "cash visible in both portfolios" (a duplicate the user
    // can spot and reverse), not "phantom debit on the source".
    trnIds.push(
      await postTrn({
        portfolioId,
        trnType: "DEPOSIT",
        assetId: depositAssetId,
        currency: account.currency,
        amount: account.amount,
      }),
    )
    if (account.sourcePortfolioId || account.sourceAssetId) {
      // Withdraw from either the specific source asset (e.g. a bank-account
      // PRIVATE line) when provided, or fall back to the portfolio's
      // generic CASH/{ccy} asset. Broker-tagged cash only exists on the
      // destination, never the source.
      const sourceAssetId =
        account.sourceAssetId ?? (await ensureCashAsset(account.currency))
      // If sourceAssetId is supplied without an explicit sourcePortfolioId,
      // assume the asset lives on the same portfolio the wizard is
      // attaching the broker to (true for the onboarding flow's
      // bank-account-on-default-portfolio case).
      const sourcePortfolioId = account.sourcePortfolioId ?? portfolioId
      trnIds.push(
        await postTrn({
          portfolioId: sourcePortfolioId,
          trnType: "WITHDRAWAL",
          assetId: sourceAssetId,
          currency: account.currency,
          amount: account.amount,
        }),
      )
    }
  }

  return { broker, portfolioId, portfolioCode, trnIds }
}
