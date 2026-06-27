import React from "react"

export type PortfolioMode = "new" | "existing"

interface PortfolioModeChooserProps {
  mode: PortfolioMode
  onSelect: (mode: PortfolioMode) => void
  // Disable the "existing" option when the user has no portfolios to attach to.
  existingDisabled: boolean
}

/**
 * Shared "how do you want to keep this brokerage?" chooser: the new-vs-existing
 * explanatory cards plus the net-worth reassurance note. Used by both the
 * standalone Open Brokerage wizard and the onboarding brokerage step so the
 * guidance stays identical. Each caller renders its own contextual inputs
 * (code/name vs existing-portfolio selector) beneath this control.
 */
const PortfolioModeChooser: React.FC<PortfolioModeChooserProps> = ({
  mode,
  onSelect,
  existingDisabled,
}) => (
  <div className="space-y-6">
    <p className="text-sm text-gray-500">
      How would you like to keep this brokerage?
    </p>

    <fieldset className="space-y-3">
      <legend className="sr-only">Choose how to track this brokerage</legend>

      <label
        className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
          existingDisabled
            ? "border-gray-200 opacity-50 cursor-not-allowed"
            : mode === "existing"
              ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-300 cursor-pointer"
              : "border-gray-200 hover:border-gray-300 cursor-pointer"
        }`}
      >
        <input
          type="radio"
          name="portfolio-mode"
          className="mt-1"
          checked={mode === "existing"}
          onChange={() => onSelect("existing")}
          disabled={existingDisabled}
        />
        <span className="flex-1">
          <span className="block font-medium text-gray-900">
            Zen Mode — keep one portfolio{" "}
            {existingDisabled && (
              <span className="font-normal text-gray-400">(none yet)</span>
            )}
          </span>
          <span className="block text-sm text-gray-500 mt-1 leading-relaxed">
            Fold this brokerage into a portfolio you already have — one combined
            view, one number to watch. The simplest way to track everything as a
            single pot.
          </span>
        </span>
      </label>

      <label
        className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
          mode === "new"
            ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-300"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <input
          type="radio"
          name="portfolio-mode"
          className="mt-1"
          checked={mode === "new"}
          onChange={() => onSelect("new")}
        />
        <span className="flex-1">
          <span className="block font-medium text-gray-900">
            Master Mode — a dedicated portfolio
          </span>
          <span className="block text-sm text-gray-500 mt-1 leading-relaxed">
            Give this brokerage its own space with its own objectives, kept
            apart from your other assets. Choose this when you want to judge it
            on its own goals.
          </span>
        </span>
      </label>
    </fieldset>

    <p className="text-xs text-gray-500 leading-relaxed">
      Either way, Beancounter totals your net worth across every portfolio —
      this only decides how you{"’"}d like to view these assets, not what you
      can see.
    </p>
  </div>
)

export default PortfolioModeChooser
