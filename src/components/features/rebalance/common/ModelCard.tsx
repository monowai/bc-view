import React from "react"
import Spinner from "@components/ui/Spinner"
import { ModelDto } from "types/rebalance"

interface ModelCardProps {
  model: ModelDto
  selected: boolean
  onClick: () => void
  /** "list" = SelectPlanDialog's compact row; "grid" = InvestCashDialog's
   *  richer tile. Each reproduces its call site's original markup exactly —
   *  merged here only for the shared model-picker props/filter logic. */
  variant: "list" | "grid"
  /** list variant only — disables the card while another selection loads. */
  disabled?: boolean
  /** list variant only — shows a spinner instead of the chevron affordance. */
  loading?: boolean
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  selected,
  onClick,
  variant,
  disabled = false,
  loading = false,
}) => {
  if (variant === "grid") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`group flex flex-col gap-2 text-left p-3 border rounded-xl transition-all ${
          selected
            ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50"
            : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex-none flex h-8 w-8 items-center justify-center rounded-lg ${
                selected
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600"
              }`}
            >
              <i className="fas fa-layer-group"></i>
            </span>
            <span className="font-semibold text-gray-900 truncate">
              {model.name}
            </span>
          </div>
          <span className="flex-none inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-700">
            <i className="fas fa-check-circle mr-1"></i>v
            {model.currentPlanVersion}
          </span>
        </div>

        {model.objective && (
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 truncate">
            {model.objective}
          </div>
        )}

        {model.description && (
          <p className="text-xs text-gray-500 line-clamp-2">
            {model.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
            {model.baseCurrency}
          </span>
          <span
            className="inline-flex items-center gap-1"
            title={`Risk ${model.risk ?? 5} of 5`}
            aria-label={`Risk ${model.risk ?? 5} of 5`}
          >
            <span className="text-gray-400">Risk</span>
            <span className="inline-flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <i
                  key={n}
                  className={`fas fa-star text-[10px] ${
                    n <= (model.risk ?? 5) ? "text-amber-400" : "text-gray-300"
                  }`}
                ></i>
              ))}
            </span>
          </span>
          {model.shared && (
            <span className="inline-flex items-center gap-1 text-indigo-600">
              <i className="fas fa-users"></i>Shared
            </span>
          )}
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-full text-left p-4 border rounded-lg transition-colors ${
        selected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
      } disabled:opacity-50`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{model.name}</div>
          {model.objective && (
            <div className="text-sm text-gray-500 truncate">
              {model.objective}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {model.baseCurrency}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
              <i className="fas fa-check-circle mr-1"></i>v
              {model.currentPlanVersion}
            </span>
          </div>
        </div>
        {loading ? (
          <Spinner className="text-blue-500 ml-2" />
        ) : (
          <i className="fas fa-chevron-right text-gray-400 ml-2"></i>
        )}
      </div>
    </button>
  )
}

export default ModelCard
