import React from "react"
import { Portfolio } from "types/beancounter"
import Dialog from "@components/ui/Dialog"

interface PortfolioPickerDialogProps {
  title: string
  prompt: string
  portfolios: Portfolio[]
  onSelect: (portfolio: Portfolio) => void
  onClose: () => void
}

/**
 * Shared "which portfolio?" picker — a Dialog with a button list of
 * portfolios. Used wherever master-mode users must choose a target portfolio
 * (asset trade, CPF/composite link-on-create). Zen-mode auto-targeting (sole
 * portfolio, no prompt) is decided by the caller via `@lib/user/zenMode`;
 * this component only renders the choice when there genuinely is one.
 */
export default function PortfolioPickerDialog({
  title,
  prompt,
  portfolios,
  onSelect,
  onClose,
}: PortfolioPickerDialogProps): React.ReactElement {
  return (
    <Dialog title={title} onClose={onClose} maxWidth="md" scrollable>
      <p className="text-sm text-gray-500">{prompt}</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {portfolios.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg text-left hover:border-invest-300 hover:bg-invest-50 focus:outline-none focus:ring-2 focus:ring-invest-500"
          >
            <span>
              <span className="font-medium text-gray-900">{p.name}</span>
              <span className="block text-sm text-gray-500">{p.code}</span>
            </span>
            <span className="text-sm text-gray-500">{p.currency.code}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}
