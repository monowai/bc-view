import React from "react"
import Link from "next/link"
import type { Portfolio } from "types/beancounter"

export interface BrokerageStepProps {
  enabled: boolean
  brokerName: string
  sourcePortfolioId: string // "" → no source (cash injection)
  amount: string // free text; parsed at submit
  currency: string // defaults to base
  // Portfolios the user already has — used to populate the source dropdown.
  // The default portfolio created earlier in this onboarding is NOT in this
  // list because it lives in component state, not the backend yet; we expose
  // it as a synthetic "Default portfolio" option via the defaultPortfolioName
  // prop instead.
  existingPortfolios: Portfolio[]
  defaultPortfolioName: string
  onEnabledChange: (v: boolean) => void
  onBrokerNameChange: (v: string) => void
  onSourcePortfolioIdChange: (v: string) => void
  onAmountChange: (v: string) => void
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
  sourcePortfolioId,
  amount,
  currency,
  existingPortfolios,
  defaultPortfolioName,
  onEnabledChange,
  onBrokerNameChange,
  onSourcePortfolioIdChange,
  onAmountChange,
}) => {
  // Filter source portfolios to the chosen currency (same-currency v1).
  const sameCurrencySources = existingPortfolios.filter(
    (p) => p.currency?.code === currency,
  )
  return (
    <div className="py-2">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {"Brokerage account"}
      </h2>
      <p className="text-gray-600 mb-4 text-sm">
        {
          "Optional — set up a broker, attach it to a portfolio, and record your opening cash deposit. You can do this later from "
        }
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
            <p className="text-xs text-gray-500 mt-1">
              {`Cash will land on a broker-tagged line (e.g. ${brokerName || "BROKER"}-${currency}) on your default portfolio "${defaultPortfolioName}".`}
            </p>
          </div>

          <div>
            <label
              htmlFor="ob-amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {`Opening deposit (${currency})`}
            </label>
            <input
              id="ob-amount"
              type="number"
              inputMode="decimal"
              min="0"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0"
            />
          </div>

          <div>
            <label
              htmlFor="ob-source"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Source portfolio (optional)"}
            </label>
            <select
              id="ob-source"
              value={sourcePortfolioId}
              onChange={(e) => onSourcePortfolioIdChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">— None (standalone deposit) —</option>
              {sameCurrencySources.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {
                "Picking a source posts a matching withdrawal so the source's cash balance stays accurate."
              }
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default BrokerageStep
