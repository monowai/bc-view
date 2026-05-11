import React from "react"
import {
  Control,
  useFieldArray,
  useWatch,
  UseFormSetValue,
} from "react-hook-form"
import { AssetDisposal, WizardFormData } from "types/independence"
import { usePrivateAssetConfigs } from "@lib/assets/usePrivateAssetConfigs"

interface AssetDisposalsListProps {
  control: Control<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
}

/**
 * Editor for the plan's AssetDisposal records.
 *
 * Each disposal is bound to a specific tracked asset and triggers pool
 * transfers + rental suppression at its `disposalAge`. The `enabled`
 * toggle is the per-plan "what-if" switch — same disposal record can
 * fire in one plan and stay dormant in another without editing the
 * underlying values.
 *
 * Add new disposals via the Sell & Downsize wizard above; this panel
 * is the list + edit + delete surface for what's already on the plan.
 */
export default function AssetDisposalsList({
  control,
  setValue,
}: AssetDisposalsListProps): React.ReactElement | null {
  const disposals = useWatch({ control, name: "assetDisposals" }) || []
  const { fields, remove } = useFieldArray({
    control,
    name: "assetDisposals",
  })
  const { assetNames } = usePrivateAssetConfigs()

  if (fields.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">
        Planned Asset Disposals ({fields.length})
      </h3>
      {fields.map((field, index) => {
        const disposal = disposals[index] as AssetDisposal | undefined
        if (!disposal) return null
        const enabled = disposal.enabled !== false
        const name = assetNames[disposal.assetId] || disposal.assetId
        const cashPct = disposal.cashRetainedPct ?? 0
        const txPct = disposal.txCostsPct ?? 0
        const replacementPct = Math.max(0, 100 - cashPct - txPct)

        return (
          <div
            key={field.id}
            className={`p-3 rounded-lg border ${
              enabled
                ? "bg-amber-50 border-amber-200"
                : "bg-gray-50 border-gray-200 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <i className="fas fa-home text-amber-600 text-xs"></i>
                  <span className="text-sm font-medium text-gray-900">
                    {name}
                  </span>
                  <span className="text-xs text-gray-500">
                    @ age {disposal.disposalAge}
                  </span>
                  {!enabled && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                      disabled
                    </span>
                  )}
                </div>
                {disposal.description && (
                  <p className="text-xs text-gray-600 italic">
                    {disposal.description}
                  </p>
                )}
                <div className="text-xs text-gray-700 font-mono">
                  ${disposal.currentValue.toLocaleString()}
                  {" → "}
                  {cashPct}% cash · {replacementPct}% replacement · {txPct}% costs
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      setValue(
                        `assetDisposals.${index}.enabled`,
                        e.target.checked,
                      )
                    }
                    className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  Enabled
                </label>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-xs text-red-600 hover:text-red-800"
                  title="Remove disposal"
                >
                  <i className="fas fa-trash mr-1"></i>
                  Remove
                </button>
              </div>
            </div>
          </div>
        )
      })}
      <p className="text-[10px] text-gray-400 italic">
        Toggle Enabled to model &ldquo;what if I don&rsquo;t sell?&rdquo;
        without losing the disposal record.
      </p>
    </div>
  )
}
