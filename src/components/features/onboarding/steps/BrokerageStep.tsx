import React from "react"
import Link from "next/link"
import MathInput from "@components/ui/MathInput"
import PortfolioModeChooser, {
  type PortfolioMode,
} from "@components/features/openBrokerage/PortfolioModeChooser"
import type { Portfolio } from "types/beancounter"
import type { BankAccount } from "../OnboardingWizard"

// The source dropdown's value encodes WHICH backend object the WITHDRAWAL
// should hit: a portfolio (uses its generic cash asset) or a specific
// bank-account asset on the default portfolio (e.g. the "DBS" PRIVATE
// line the user just added in step 4). Format keeps both shapes in a
// single <select> value string.
//   ""                              → no source (standalone deposit)
//   "portfolio:{id}"                → withdraw from portfolio's CASH/{ccy}
//   "bankAccount:{name}"            → withdraw from bank-account asset
export type SourceValue = "" | `portfolio:${string}` | `bankAccount:${string}`

export interface BrokerageStepProps {
  enabled: boolean
  brokerName: string
  source: SourceValue
  amount: string // free text; parsed at submit
  // User-chosen reporting currency for the new brokerage portfolio.
  // Defaults to the user's baseCurrency but they can pick any code from
  // `currencyCodes` (e.g. USD broker funded from SGD bank balances).
  currency: string
  currencyCodes: string[]
  // Portfolios the user already has — used to populate the source dropdown.
  // The default portfolio created earlier in this onboarding is NOT in this
  // list because it lives in component state, not the backend yet; we expose
  // it as a synthetic "Default portfolio" option via the defaultPortfolioName
  // prop instead.
  existingPortfolios: Portfolio[]
  // Bank accounts the user added in step 4 — surfaced as additional source
  // options so the brokerage deposit can be funded from a specific
  // bank-account line on the default portfolio.
  bankAccounts: BankAccount[]
  defaultPortfolioName: string
  // Portfolio choice — same new-vs-existing decision as the standalone
  // /tools/open-brokerage wizard, so onboarding behaves identically.
  portfolioMode: PortfolioMode
  existingPortfolioId: string
  onEnabledChange: (v: boolean) => void
  onBrokerNameChange: (v: string) => void
  onSourceChange: (v: SourceValue) => void
  onAmountChange: (v: string) => void
  onCurrencyChange: (v: string) => void
  onPortfolioModeChange: (v: PortfolioMode) => void
  onExistingPortfolioChange: (id: string) => void
}

/**
 * Optional brokerage setup as a step inside the onboarding wizard.
 * Compact form — only the fields needed to drive the openBrokerage
 * orchestrator. Reuses the orchestrator from the standalone wizard at
 * /tools/open-brokerage so the two surfaces stay consistent.
 */
const BrokerageStep: React.FC<BrokerageStepProps> = ({
  enabled,
  brokerName,
  source,
  amount,
  currency,
  currencyCodes,
  existingPortfolios,
  bankAccounts,
  defaultPortfolioName,
  portfolioMode,
  existingPortfolioId,
  onEnabledChange,
  onBrokerNameChange,
  onSourceChange,
  onAmountChange,
  onCurrencyChange,
  onPortfolioModeChange,
  onExistingPortfolioChange,
}) => {
  // Filter source options to the chosen currency (same-currency v1).
  const sameCurrencyPortfolios = existingPortfolios.filter(
    (p) => p.currency?.code === currency,
  )
  const sameCurrencyBankAccounts = bankAccounts.filter(
    (b) => b.currency === currency,
  )
  // If the user has bank accounts but none in the chosen currency, they
  // probably expected to fund from a different-currency balance. Surface
  // it explicitly so they don't end up with a silent standalone deposit.
  const otherCurrencyBankAccounts = bankAccounts.filter(
    (b) => b.currency !== currency,
  )
  const showFxNotice =
    sameCurrencyBankAccounts.length === 0 &&
    otherCurrencyBankAccounts.length > 0
  return (
    <div className="py-2">
      <p className="text-gray-500 text-xs mb-3">
        {"Also available later from "}
        <Link
          href="/tools/open-brokerage"
          className="text-purple-600 hover:underline"
        >
          {"Tools → Open Brokerage"}
        </Link>
        {"."}
      </p>

      <label className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span className="text-sm font-medium text-gray-700">
          {"Yes, set up a brokerage account now"}
        </span>
      </label>

      {enabled && (
        <div className="space-y-3 max-w-md">
          <div>
            <label
              htmlFor="ob-broker"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Broker name"}
            </label>
            <input
              id="ob-broker"
              type="text"
              value={brokerName}
              onChange={(e) => onBrokerNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g. IBRK"
            />
            {portfolioMode === "new" && (
              <p className="text-xs text-gray-500 mt-1">
                {`A new portfolio "${brokerName || "BROKER"} Portfolio" will be created for your brokerage, keeping its cash and trades separate from your "${defaultPortfolioName}" bank-account portfolio.`}
              </p>
            )}
          </div>

          <PortfolioModeChooser
            mode={portfolioMode}
            onSelect={onPortfolioModeChange}
            existingDisabled={existingPortfolios.length === 0}
          />

          {portfolioMode === "existing" ? (
            <div>
              <label
                htmlFor="ob-existing"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Existing portfolio"}
              </label>
              <select
                id="ob-existing"
                value={existingPortfolioId}
                onChange={(e) => onExistingPortfolioChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">— Select —</option>
                {existingPortfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}, {p.currency?.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {`The brokerage's cash lands on a per-broker line (e.g. ${brokerName || "BROKER"}-${currency}) so it stays separate from any existing cash on this portfolio.`}
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="ob-currency"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Reporting currency"}
              </label>
              <select
                id="ob-currency"
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {currencyCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {`Cash and trades in this brokerage portfolio will report in ${currency}. Picking a different currency from the bank-account source needs FX (not handled in v1 — same-currency source only).`}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="ob-amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {`Opening deposit (${currency})`}
            </label>
            <MathInput
              id="ob-amount"
              value={amount}
              onChange={(v) => onAmountChange(v === 0 ? "" : String(v))}
              min={0}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label
              htmlFor="ob-source"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Source (optional)"}
            </label>
            {showFxNotice && (
              <div className="mb-2 px-3 py-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {`You have bank accounts in ${otherCurrencyBankAccounts
                  .map((b) => b.currency)
                  .filter((c, i, a) => a.indexOf(c) === i)
                  .join(
                    ", ",
                  )} but the brokerage currency is ${currency}. Cross-currency funding (FX) isn't supported yet — the opening deposit will be recorded as a standalone cash injection on the new portfolio with no matching withdrawal.`}
              </div>
            )}
            <select
              id="ob-source"
              value={source}
              onChange={(e) => onSourceChange(e.target.value as SourceValue)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">— None (standalone deposit) —</option>
              {sameCurrencyBankAccounts.length > 0 && (
                <optgroup label={`Bank accounts on "${defaultPortfolioName}"`}>
                  {sameCurrencyBankAccounts.map((b) => (
                    <option key={`b-${b.name}`} value={`bankAccount:${b.name}`}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {sameCurrencyPortfolios.length > 0 && (
                <optgroup label="Other portfolios">
                  {sameCurrencyPortfolios.map((p) => (
                    <option key={`p-${p.id}`} value={`portfolio:${p.id}`}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {
                "Picking a source posts a matching withdrawal so the source's cash stays accurate."
              }
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default BrokerageStep
