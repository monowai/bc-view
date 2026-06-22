import React, { useMemo, useState } from "react"
import useSwr from "swr"
import {
  openBrokerage,
  type OpenBrokerageResult,
} from "@lib/openBrokerage/orchestrate"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import PortfolioModeChooser from "@components/features/openBrokerage/PortfolioModeChooser"
import type { Broker, Currency, Portfolio } from "types/beancounter"

type Step = "broker" | "portfolio" | "funding" | "review" | "done"

interface BrokerState {
  mode: "existing" | "new"
  existingId: string
  newName: string
  newAccountNumber: string
}

interface PortfolioState {
  mode: "new" | "existing"
  // mode === "new"
  code: string
  name: string
  currency: string
  // mode === "existing"
  existingId: string
}

interface FundingState {
  amount: string // free-text input; parsed at submit
  sourcePortfolioId: string // empty = no source (cash injection)
}

// Fallback list — used only if /api/currencies hasn't returned yet so the
// dropdown isn't empty on first paint. Replaced by backend response as soon
// as SWR resolves.
const FALLBACK_CURRENCIES = [
  "USD",
  "SGD",
  "EUR",
  "GBP",
  "AUD",
  "NZD",
  "HKD",
  "JPY",
]

const STEP_TITLES: Record<Exclude<Step, "done">, string> = {
  broker: "Broker",
  portfolio: "Portfolio",
  funding: "Funding (optional)",
  review: "Review",
}

const STEP_ORDER: Exclude<Step, "done">[] = [
  "broker",
  "portfolio",
  "funding",
  "review",
]

function StepHeader({
  step,
}: {
  step: Exclude<Step, "done">
}): React.ReactElement {
  const idx = STEP_ORDER.indexOf(step) + 1
  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
        Step {idx} of {STEP_ORDER.length}
      </p>
      <h1 className="text-2xl font-bold text-gray-900">{STEP_TITLES[step]}</h1>
    </div>
  )
}

export default function OpenBrokerageWizard(): React.ReactElement {
  const [step, setStep] = useState<Step>("broker")
  const [broker, setBroker] = useState<BrokerState>({
    mode: "new",
    existingId: "",
    newName: "",
    newAccountNumber: "",
  })
  const [portfolio, setPortfolio] = useState<PortfolioState>({
    mode: "new",
    code: "",
    name: "",
    currency: "USD",
    existingId: "",
  })
  const [funding, setFunding] = useState<FundingState>({
    amount: "",
    sourcePortfolioId: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OpenBrokerageResult | null>(null)

  const { data: brokersData } = useSwr<{ data: Broker[] }>(
    "/api/brokers",
    simpleFetcher("/api/brokers"),
  )
  const { data: portfoliosData } = useSwr<{ data: Portfolio[] }>(
    "/api/portfolios",
    simpleFetcher("/api/portfolios"),
  )
  const { data: currenciesData } = useSwr<{ data: Currency[] }>(
    ccyKey,
    simpleFetcher(ccyKey),
  )
  const brokers = useMemo(() => brokersData?.data ?? [], [brokersData])
  const portfolios = useMemo(() => portfoliosData?.data ?? [], [portfoliosData])
  const currencyCodes = useMemo(() => {
    const codes = currenciesData?.data?.map((c) => c.code)
    return codes && codes.length > 0 ? codes : FALLBACK_CURRENCIES
  }, [currenciesData])

  const sameCurrencySources = useMemo(
    () => portfolios.filter((p) => p.currency?.code === portfolio.currency),
    [portfolios, portfolio.currency],
  )

  // If the user backs up and changes the portfolio currency, drop a
  // previously-picked source portfolio if it no longer matches.
  // Otherwise a cross-currency source id would sneak through to submit.
  // Render-phase reset: the guard is self-terminating (clearing the id makes
  // the condition false on the next render), so it never loops.
  if (
    funding.sourcePortfolioId &&
    !sameCurrencySources.some((p) => p.id === funding.sourcePortfolioId)
  ) {
    setFunding((f) => ({ ...f, sourcePortfolioId: "" }))
  }

  const brokerValid =
    broker.mode === "existing"
      ? !!broker.existingId
      : broker.newName.trim().length > 0
  const portfolioValid =
    portfolio.mode === "existing"
      ? !!portfolio.existingId
      : portfolio.code.trim().length > 0 && portfolio.name.trim().length > 0

  const back = (): void => {
    const i = STEP_ORDER.indexOf(step as Exclude<Step, "done">)
    if (i > 0) setStep(STEP_ORDER[i - 1])
  }

  const advance = (): void => {
    const i = STEP_ORDER.indexOf(step as Exclude<Step, "done">)
    if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1])
  }

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      const amount = parseFloat(funding.amount)
      const res = await openBrokerage({
        broker: {
          mode: broker.mode,
          existingId: broker.existingId || undefined,
          newName: broker.newName || undefined,
          newAccountNumber: broker.newAccountNumber || undefined,
        },
        portfolio:
          portfolio.mode === "existing"
            ? {
                mode: "existing",
                existingId: portfolio.existingId,
                currency: portfolio.currency,
              }
            : {
                mode: "new",
                code: portfolio.code,
                name: portfolio.name,
                currency: portfolio.currency,
                base: portfolio.currency,
              },
        funding:
          Number.isFinite(amount) && amount > 0
            ? {
                amount,
                currency: portfolio.currency,
                sourcePortfolioId: funding.sourcePortfolioId || undefined,
              }
            : undefined,
      })
      setResult(res)
      setStep("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (step === "done") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {"Done — brokerage opened"}
        </h1>
        <p className="text-gray-600 mb-6">
          {`Portfolio ${portfolio.code} ready. `}
          {result?.trnIds.length
            ? `${result.trnIds.length} cash transaction(s) posted.`
            : "No initial deposit posted."}
        </p>
        <a
          href={`/holdings/${result?.portfolioId ?? ""}`}
          className="btn-primary"
        >
          {"View the portfolio"}
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <StepHeader step={step} />
      {error && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 rounded bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {step === "broker" && (
        <div className="space-y-4">
          <fieldset className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="broker-mode"
                checked={broker.mode === "new"}
                onChange={() => setBroker({ ...broker, mode: "new" })}
              />
              <span>Create a new broker</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="broker-mode"
                checked={broker.mode === "existing"}
                onChange={() => setBroker({ ...broker, mode: "existing" })}
                disabled={brokers.length === 0}
              />
              <span>
                Use an existing broker {brokers.length === 0 && "(none yet)"}
              </span>
            </label>
          </fieldset>

          {broker.mode === "new" ? (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="broker-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {"Broker name"}
                </label>
                <input
                  id="broker-name"
                  type="text"
                  value={broker.newName}
                  onChange={(e) =>
                    setBroker({ ...broker, newName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g. Interactive Brokers"
                />
              </div>
              <div>
                <label
                  htmlFor="broker-acct"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {"Account number (optional)"}
                </label>
                <input
                  id="broker-acct"
                  type="text"
                  value={broker.newAccountNumber}
                  onChange={(e) =>
                    setBroker({ ...broker, newAccountNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="broker-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Existing broker"}
              </label>
              <select
                id="broker-select"
                value={broker.existingId}
                onChange={(e) =>
                  setBroker({ ...broker, existingId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">— Select —</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {step === "portfolio" && (
        <div className="space-y-6">
          <PortfolioModeChooser
            mode={portfolio.mode}
            onSelect={(mode) => setPortfolio({ ...portfolio, mode })}
            existingDisabled={portfolios.length === 0}
          />

          <div className="space-y-4 pt-4 border-t border-gray-100">
            {portfolio.mode === "existing" ? (
              <div>
                <label
                  htmlFor="pf-existing"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {"Existing portfolio"}
                </label>
                <select
                  id="pf-existing"
                  value={portfolio.existingId}
                  onChange={(e) => {
                    const id = e.target.value
                    const pf = portfolios.find((p) => p.id === id)
                    setPortfolio({
                      ...portfolio,
                      existingId: id,
                      currency: pf?.currency?.code ?? portfolio.currency,
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">— Select —</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}, {p.currency?.code})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {`Deposits will land on a per-broker cash line (e.g. ${broker.newName || "BROKER"}-${portfolio.currency}) so the brokerage cash stays separate from any existing cash on this portfolio.`}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="pf-code"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {"Portfolio code"}
                  </label>
                  <input
                    id="pf-code"
                    type="text"
                    value={portfolio.code}
                    onChange={(e) =>
                      setPortfolio({ ...portfolio, code: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g. IBRK"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pf-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {"Portfolio name"}
                  </label>
                  <input
                    id="pf-name"
                    type="text"
                    value={portfolio.name}
                    onChange={(e) =>
                      setPortfolio({ ...portfolio, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g. Interactive Brokers"
                  />
                </div>
              </>
            )}
            {portfolio.mode === "new" && (
              <div>
                <label
                  htmlFor="pf-ccy"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {"Currency"}
                </label>
                <select
                  id="pf-ccy"
                  value={portfolio.currency}
                  onChange={(e) =>
                    setPortfolio({ ...portfolio, currency: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {currencyCodes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "funding" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {`Optional — fund the new portfolio in ${portfolio.currency}. Pick a source portfolio (must be in ${portfolio.currency}) to record a matching withdrawal, or leave blank for a standalone deposit.`}
          </p>
          <div>
            <label
              htmlFor="fund-amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Amount"}
            </label>
            <input
              id="fund-amount"
              type="number"
              inputMode="decimal"
              min="0"
              value={funding.amount}
              onChange={(e) =>
                setFunding({ ...funding, amount: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0"
            />
          </div>
          <div>
            <label
              htmlFor="fund-source"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Source portfolio (optional)"}
            </label>
            <select
              id="fund-source"
              value={funding.sourcePortfolioId}
              onChange={(e) =>
                setFunding({ ...funding, sourcePortfolioId: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">— None (deposit only) —</option>
              {sameCurrencySources.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm">
            <dl className="grid grid-cols-3 gap-y-2">
              <dt className="text-gray-500">Broker</dt>
              <dd className="col-span-2 text-gray-900">
                {broker.mode === "new"
                  ? `${broker.newName} (new)`
                  : (brokers.find((b) => b.id === broker.existingId)?.name ??
                    "")}
              </dd>
              <dt className="text-gray-500">Portfolio</dt>
              <dd className="col-span-2 text-gray-900">
                {portfolio.mode === "existing"
                  ? `${portfolios.find((p) => p.id === portfolio.existingId)?.name ?? "?"} (existing, ${portfolio.currency})`
                  : `${portfolio.code} — ${portfolio.name} (new, ${portfolio.currency})`}
              </dd>
              <dt className="text-gray-500">Funding</dt>
              <dd className="col-span-2 text-gray-900">
                {funding.amount && parseFloat(funding.amount) > 0
                  ? `${parseFloat(funding.amount).toLocaleString()} ${portfolio.currency} ${
                      funding.sourcePortfolioId
                        ? `from ${portfolios.find((p) => p.id === funding.sourcePortfolioId)?.name}`
                        : "(standalone deposit)"
                    }`
                  : "None"}
              </dd>
            </dl>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={back}
          disabled={step === "broker" || submitting}
          className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:text-gray-300"
        >
          {"← Back"}
        </button>
        {step === "funding" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFunding({ amount: "", sourcePortfolioId: "" })
                advance()
              }}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              {"Skip — no deposit"}
            </button>
            <button
              type="button"
              onClick={advance}
              disabled={!funding.amount || parseFloat(funding.amount) <= 0}
              className="btn-primary btn-primary--sm disabled:opacity-50"
            >
              {"Next →"}
            </button>
          </div>
        ) : step === "review" ? (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="btn-primary btn-primary--sm disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Open Brokerage"}
          </button>
        ) : (
          <button
            type="button"
            onClick={advance}
            disabled={
              (step === "broker" && !brokerValid) ||
              (step === "portfolio" && !portfolioValid)
            }
            className="btn-primary btn-primary--sm disabled:opacity-50"
          >
            {"Next →"}
          </button>
        )}
      </div>
    </div>
  )
}
