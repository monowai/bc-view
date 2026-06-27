import React from "react"
import Link from "next/link"
import PortfolioModeChooser, {
  type PortfolioMode,
} from "@components/features/openBrokerage/PortfolioModeChooser"
import {
  deriveBrokerCode,
  brokerCashAssetCode,
} from "@lib/openBrokerage/brokerCode"

export interface BrokerageStepProps {
  enabled: boolean
  brokerName: string
  // Currencies the user expects to trade. One per-broker cash account
  // ({code}-{ccy}) is opened for each and registered as the broker's default
  // settlement account for that currency. Opening balances are recorded later
  // (Tools → Open Brokerage, or a normal cash deposit) — this step never moves
  // cash, it just stands the accounts up.
  currencies: string[]
  currencyCodes: string[]
  defaultPortfolioName: string
  // Zen vs Master — same decision as the standalone /tools/open-brokerage
  // wizard. Zen attaches the broker to the user's main (default) portfolio;
  // Master gives it a dedicated portfolio. Both open the same per-broker,
  // per-currency cash lines.
  portfolioMode: PortfolioMode
  onEnabledChange: (v: boolean) => void
  onBrokerNameChange: (v: string) => void
  onCurrenciesChange: (v: string[]) => void
  onPortfolioModeChange: (v: PortfolioMode) => void
}

/**
 * Optional brokerage setup as a step inside the onboarding wizard. The user
 * names the broker and picks the currencies they expect to trade; on submit the
 * wizard opens one per-broker cash account per currency and registers each as
 * the broker's default settlement account. Reuses the orchestrator from the
 * standalone wizard at /tools/open-brokerage so the two surfaces stay consistent.
 */
const BrokerageStep: React.FC<BrokerageStepProps> = ({
  enabled,
  brokerName,
  currencies,
  currencyCodes,
  defaultPortfolioName,
  portfolioMode,
  onEnabledChange,
  onBrokerNameChange,
  onCurrenciesChange,
  onPortfolioModeChange,
}) => {
  // Abbreviated broker code (Interactive Brokers → IB) shown live so the user
  // sees the code and the resulting cash-account names ({code}-{ccy}) before
  // submitting.
  const brokerCode = deriveBrokerCode(brokerName)
  // Reporting currency of the dedicated (Master) portfolio — the first picked
  // currency. The portfolio still holds every selected currency's cash line.
  const primaryCurrency = currencies[0] || currencyCodes[0]

  const toggleCurrency = (code: string): void => {
    if (currencies.includes(code)) {
      onCurrenciesChange(currencies.filter((c) => c !== code))
    } else {
      onCurrenciesChange([...currencies, code])
    }
  }

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
              placeholder="e.g. Interactive Brokers"
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1">
              {"Currencies you expect to trade"}
            </legend>
            <p className="text-xs text-gray-500 mb-2">
              {
                "We'll open a cash account for each and make it the broker's default settlement account for that currency."
              }
            </p>
            <div className="flex flex-wrap gap-2">
              {currencyCodes.map((code) => {
                const checked = currencies.includes(code)
                return (
                  <label
                    key={code}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm ${
                      checked
                        ? "border-purple-400 bg-purple-50 text-purple-800"
                        : "border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCurrency(code)}
                    />
                    {code}
                  </label>
                )
              })}
            </div>
          </fieldset>

          {brokerName.trim() && currencies.length > 0 && (
            <p className="text-xs text-gray-500">
              {"Brokerage code "}
              <span className="font-mono font-medium text-gray-700">
                {brokerCode}
              </span>
              {" · cash accounts "}
              <span className="font-mono font-medium text-gray-700">
                {currencies
                  .map((c) => brokerCashAssetCode(brokerCode, c))
                  .join(", ")}
              </span>
            </p>
          )}

          <PortfolioModeChooser
            mode={portfolioMode}
            onSelect={onPortfolioModeChange}
            existingDisabled={false}
          />

          {portfolioMode === "existing" ? (
            <p className="text-xs text-gray-500">
              {`Attaches to your main portfolio ("${defaultPortfolioName}"). Trades settle to per-broker cash lines (e.g. ${brokerCashAssetCode(brokerCode || "BROKER", primaryCurrency)}). Want a dedicated portfolio? Switch to Master Mode.`}
            </p>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="text-gray-500">{"New portfolio"}</p>
              {brokerName.trim() ? (
                <p className="font-medium text-gray-900">
                  {`${brokerName} Portfolio`}
                  <span className="ml-1 font-normal text-gray-500">
                    {`(code ${brokerCode}, ${primaryCurrency})`}
                  </span>
                </p>
              ) : (
                <p className="text-gray-400">
                  {"Name your broker first — the portfolio takes its name."}
                </p>
              )}
              <p className="text-gray-500 mt-1">
                {`Kept separate from your "${defaultPortfolioName}" portfolio so its cash and trades stand on their own.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BrokerageStep
