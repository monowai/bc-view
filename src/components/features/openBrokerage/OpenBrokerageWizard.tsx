import React, { useMemo, useState } from "react"
import useSwr from "swr"
import {
  openBrokerage,
  type OpenBrokerageResult,
} from "@lib/openBrokerage/orchestrate"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import DecimalInput from "@components/ui/DecimalInput"
import { deriveBrokerCode } from "@lib/openBrokerage/brokerCode"
import {
  deriveZenModeFromPreferences,
  solePortfolio,
  solePortfolioId,
} from "@lib/user/zenMode"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
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
  // mode === "new": the portfolio code + name are derived from the broker
  // name (one less thing to type; matches the onboarding flow).
  currency: string
  // mode === "existing"
  existingId: string
}

// One currency account the user flags to open. The wizard collects a list so
// the brokerage can span several currencies (e.g. USD + SGD) in one pass. The
// account is opened even with a zero balance; `amount` is an optional opening
// deposit (0 when unfunded).
interface FundingRow {
  currency: string
  amount: number
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

// Portfolio code is the abbreviated broker code (deriveBrokerCode) so the
// user only types one field — "Interactive Brokers" → "IB" — and the code
// stays compact instead of echoing the full name.

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
    // Master users toggle this; for Zen users the effective mode is derived
    // from their posture (see effMode below), so this is just the Master
    // default — attach to an existing portfolio.
    mode: "existing",
    currency: "USD",
    existingId: "",
  })
  // Currency accounts the user flags to open + fund. Starts empty — nothing is
  // opened until the user explicitly adds a currency on the funding step.
  const [fundingRows, setFundingRows] = useState<FundingRow[]>([])
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

  const { preferences } = useUserPreferences()

  // The user's existing posture decides how the brokerage attaches:
  //  • Zen user with a sole portfolio   → fold into it, no chooser.
  //  • Zen user with no portfolio yet   → create their first one, coded/named
  //    after the broker (stays single-pot).
  //  • Master user (several portfolios) → plain attach-existing / create-new
  //    toggle, without the Zen/Master framing.
  const zen = deriveZenModeFromPreferences(portfolios.length, preferences)
  const sole = solePortfolio(portfolios)
  const masterUser = !zen

  // Auto-select the sole portfolio for attach mode; an explicit pick wins.
  const existingId = portfolio.existingId || solePortfolioId(portfolios)
  const selectedExistingPortfolio = useMemo(
    () => portfolios.find((p) => p.id === existingId),
    [portfolios, existingId],
  )

  // The new brokerage portfolio takes its identity from the broker: code is the
  // abbreviated broker code (Interactive Brokers → IB). Master mode appends
  // "Portfolio"; a zero-portfolio Zen user's first portfolio is named after the
  // broker outright.
  const brokerName =
    broker.mode === "new"
      ? broker.newName.trim()
      : (brokers.find((b) => b.id === broker.existingId)?.name ?? "")
  const derivedCode = deriveBrokerCode(brokerName)
  const derivedName = brokerName ? `${brokerName} Portfolio` : ""

  // Effective portfolio decision after applying the zen posture. Zen+sole folds
  // into the lone portfolio; Zen+none creates the first portfolio; Master lets
  // the user toggle existing-vs-new.
  const effMode: "existing" | "new" =
    zen && sole ? "existing" : zen && !sole ? "new" : portfolio.mode
  const newPortfolioName = zen && !sole ? brokerName : derivedName

  const existingCurrency =
    selectedExistingPortfolio?.currency?.code ?? portfolio.currency
  const effectiveCurrency =
    effMode === "existing" ? existingCurrency : portfolio.currency

  const currencyCodes = useMemo(() => {
    const codes = currenciesData?.data?.map((c) => c.code)
    return codes && codes.length > 0 ? codes : FALLBACK_CURRENCIES
  }, [currenciesData])

  const brokerValid =
    broker.mode === "existing"
      ? !!broker.existingId
      : broker.newName.trim().length > 0
  const portfolioValid =
    effMode === "existing" ? !!existingId : derivedCode.length > 0

  const back = (): void => {
    const i = STEP_ORDER.indexOf(step as Exclude<Step, "done">)
    if (i > 0) setStep(STEP_ORDER[i - 1])
  }

  const advance = (): void => {
    const i = STEP_ORDER.indexOf(step as Exclude<Step, "done">)
    if (i < STEP_ORDER.length - 1) {
      // No cash account is seeded — the funding step opens empty and the user
      // explicitly adds each currency they want via "Add a currency account".
      setStep(STEP_ORDER[i + 1])
    }
  }

  const updateRow = (idx: number, patch: Partial<FundingRow>): void =>
    setFundingRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    )

  const addCurrencyRow = (currency: string): void =>
    setFundingRows((rows) => [...rows, { currency, amount: 0 }])

  const removeRow = (idx: number): void =>
    setFundingRows((rows) => rows.filter((_, i) => i !== idx))

  // Currencies not yet opened as accounts — offered in the "add" dropdown.
  const availableCurrencies = currencyCodes.filter(
    (c) => !fundingRows.some((r) => r.currency === c),
  )

  // Accounts to open: every listed currency, even with no opening deposit.
  // `amount` is the opening deposit (0 when unfunded).
  const accountsToOpen = fundingRows.map((r) => ({
    currency: r.currency,
    amount: r.amount,
  }))

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      const existingCode =
        effMode === "existing" ? (selectedExistingPortfolio?.code ?? "") : ""
      const res = await openBrokerage({
        broker: {
          mode: broker.mode,
          existingId: broker.existingId || undefined,
          newName: broker.newName || undefined,
          newAccountNumber: broker.newAccountNumber || undefined,
        },
        portfolio:
          effMode === "existing"
            ? {
                mode: "existing",
                existingId,
                code: existingCode,
                currency: existingCurrency,
              }
            : {
                mode: "new",
                code: derivedCode,
                name: newPortfolioName,
                currency: portfolio.currency,
                base: portfolio.currency,
              },
        // Empty list and undefined are equivalent downstream (orchestrate
        // iterates `funding ?? []`), so pass the mapped list as-is.
        funding: accountsToOpen,
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
          {`Portfolio ${effMode === "existing" ? (selectedExistingPortfolio?.code ?? "") : derivedCode} ready. `}
          {result?.accountIds.length
            ? `${result.accountIds.length} currency account(s) opened. `
            : ""}
          {result?.trnIds.length
            ? `${result.trnIds.length} cash transaction(s) posted.`
            : result?.accountIds.length
              ? "No opening deposit — accounts start empty."
              : "No initial deposit posted."}
        </p>
        <a
          href={`/holdings/${result?.portfolioCode ?? ""}`}
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
          {masterUser ? (
            // Master user: plain attach-vs-create toggle, no Zen/Master cards.
            <fieldset className="space-y-3">
              <legend className="text-sm text-gray-700 mb-1">
                {"How would you like to track this brokerage?"}
              </legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pf-mode"
                  checked={portfolio.mode === "existing"}
                  onChange={() =>
                    setPortfolio((prev) => ({ ...prev, mode: "existing" }))
                  }
                />
                <span>Attach to an existing portfolio</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pf-mode"
                  checked={portfolio.mode === "new"}
                  onChange={() =>
                    setPortfolio((prev) => ({ ...prev, mode: "new" }))
                  }
                />
                <span>Create a new portfolio</span>
              </label>
            </fieldset>
          ) : effMode === "existing" ? (
            // Zen user with a sole portfolio: fold in, no chooser.
            <p className="text-sm text-gray-600">
              {`This brokerage folds into your portfolio "${sole?.name ?? ""}" — one combined view. Its cash lands on a per-broker line (${derivedCode || "BROKER"}-${effectiveCurrency}).`}
            </p>
          ) : (
            // Zen user with no portfolio yet: create their first, named after
            // the broker.
            <p className="text-sm text-gray-600">
              {`We'll create your "${brokerName || "broker"}" portfolio to hold this brokerage. Pick its currency below.`}
            </p>
          )}

          <div className="space-y-4 pt-4 border-t border-gray-100">
            {effMode === "existing" ? (
              masterUser && (
                <div>
                  <label
                    htmlFor="pf-existing"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {"Existing portfolio"}
                  </label>
                  <select
                    id="pf-existing"
                    value={existingId}
                    onChange={(e) =>
                      setPortfolio({
                        ...portfolio,
                        existingId: e.target.value,
                      })
                    }
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
                    {`Deposits land on a per-broker cash line (e.g. ${derivedCode || "BROKER"}-${effectiveCurrency}) so the brokerage cash stays separate from any existing cash on this portfolio.`}
                  </p>
                </div>
              )
            ) : (
              <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p className="text-gray-500">New portfolio</p>
                  {derivedCode ? (
                    <p className="font-medium text-gray-900">
                      {newPortfolioName}
                      <span className="ml-1 font-normal text-gray-500">
                        {`(code ${derivedCode})`}
                      </span>
                    </p>
                  ) : (
                    <p className="text-gray-400">
                      Name your broker first — the portfolio takes its name.
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="pf-ccy"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {"Default Currency"}
                  </label>
                  <select
                    id="pf-ccy"
                    value={portfolio.currency}
                    onChange={(e) =>
                      setPortfolio({
                        ...portfolio,
                        currency: e.target.value,
                      })
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
              </>
            )}
          </div>
        </div>
      )}

      {step === "funding" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {
              "Add a cash account for each currency you expect to trade. Each becomes the broker's default settlement account for that currency. Nothing is opened by default — add only what you need, with an optional opening deposit to seed cash now."
            }
          </p>

          <div className="space-y-3">
            {fundingRows.map((row, idx) => (
              <div
                key={row.currency}
                className="rounded-lg border border-gray-200 p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {`${row.currency} account`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    {"Remove"}
                  </button>
                </div>
                <div>
                  <label
                    htmlFor={`fund-amount-${row.currency}`}
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    {`Opening deposit (${row.currency}) — optional`}
                  </label>
                  <DecimalInput
                    id={`fund-amount-${row.currency}`}
                    min="0"
                    value={row.amount}
                    onChange={(amount) => updateRow(idx, { amount })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>

          {availableCurrencies.length > 0 && (
            <div>
              <label
                htmlFor="fund-add-ccy"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {fundingRows.length === 0
                  ? "Add a currency account"
                  : "Add another currency account"}
              </label>
              <select
                id="fund-add-ccy"
                value=""
                onChange={(e) => {
                  if (e.target.value) addCurrencyRow(e.target.value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">— Add currency —</option>
                {availableCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
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
                {effMode === "existing"
                  ? `${selectedExistingPortfolio?.name ?? "?"} (existing, ${effectiveCurrency})`
                  : `${derivedCode} — ${newPortfolioName} (new, ${portfolio.currency})`}
              </dd>
              <dt className="text-gray-500">Accounts</dt>
              <dd className="col-span-2 text-gray-900">
                {accountsToOpen.length ? (
                  <ul className="space-y-1">
                    {accountsToOpen.map((r) => (
                      <li key={r.currency}>
                        {r.amount > 0
                          ? `${r.currency} — opening deposit ${r.amount.toLocaleString()}`
                          : `${r.currency} — account only (no opening balance)`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "None"
                )}
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
                // Skip = open no accounts at all; clear the list so nothing
                // is created downstream.
                setFundingRows([])
                advance()
              }}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              {"Skip — no accounts"}
            </button>
            <button
              type="button"
              onClick={advance}
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
