import React, { useState } from "react"
import {
  Control,
  useFieldArray,
  useWatch,
  UseFormSetValue,
} from "react-hook-form"
import { AssetDisposal, WizardFormData } from "types/independence"
import { usePrivateAssetConfigs } from "@lib/assets/usePrivateAssetConfigs"
import MathInput from "@components/ui/MathInput"

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
 * is the list + in-place edit + delete surface for what's already on
 * the plan. assetId is intentionally not editable — to change the
 * underlying asset, remove and re-add through the wizard so the
 * holding-picker dropdown applies.
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

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
        const isEditing = editingIndex === index

        return (
          <div
            key={field.id}
            className={`p-3 rounded-lg border ${
              enabled
                ? "bg-amber-50 border-amber-200"
                : "bg-gray-50 border-gray-200 opacity-60"
            }`}
          >
            {isEditing ? (
              <DisposalEditRow
                disposal={disposal}
                index={index}
                name={name}
                setValue={setValue}
                onDone={() => setEditingIndex(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex-1 space-y-1 cursor-pointer"
                  onClick={() => setEditingIndex(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setEditingIndex(index)
                    }
                  }}
                >
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
                    {cashPct}% cash · {replacementPct}% replacement · {txPct}%
                    costs
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
                    onClick={() => setEditingIndex(index)}
                    className="text-xs text-amber-700 hover:text-amber-900"
                    title="Edit disposal"
                  >
                    <i className="fas fa-edit mr-1"></i>
                    Edit
                  </button>
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
            )}
          </div>
        )
      })}
      <p className="text-[10px] text-gray-400 italic">
        Click any disposal to edit. Toggle Enabled to model &ldquo;what if I
        don&rsquo;t sell?&rdquo; without losing the record.
      </p>
    </div>
  )
}

interface DisposalEditRowProps {
  disposal: AssetDisposal
  index: number
  name: string
  setValue: UseFormSetValue<WizardFormData>
  onDone: () => void
}

/**
 * Inline edit form for a single AssetDisposal record. Updates the
 * underlying form-array entry via setValue so changes flow into the
 * persisted plan on save. The asset identity (assetId) is read-only
 * — changing which asset is being disposed of requires removing
 * the record and re-adding through the wizard.
 */
function DisposalEditRow({
  disposal,
  index,
  name,
  setValue,
  onDone,
}: DisposalEditRowProps): React.ReactElement {
  const cashPct = disposal.cashRetainedPct ?? 0
  const txPct = disposal.txCostsPct ?? 0
  const totalsValid = cashPct + txPct <= 100
  const ageValid =
    Number.isFinite(disposal.disposalAge) &&
    disposal.disposalAge >= 18 &&
    disposal.disposalAge <= 120

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <i className="fas fa-home text-amber-600 text-xs"></i>
        <span className="text-sm font-medium text-gray-900">{name}</span>
        <span className="text-[10px] text-gray-400">
          (asset locked — remove + re-add to change)
        </span>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          type="text"
          value={disposal.description || ""}
          onChange={(e) =>
            setValue(`assetDisposals.${index}.description`, e.target.value)
          }
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Sale age
          </label>
          <input
            type="number"
            value={disposal.disposalAge || ""}
            onChange={(e) =>
              setValue(
                `assetDisposals.${index}.disposalAge`,
                parseInt(e.target.value) || 0,
              )
            }
            min={18}
            max={120}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Current value
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500 text-sm">
              $
            </span>
            <MathInput
              value={disposal.currentValue || ""}
              onChange={(v) =>
                setValue(`assetDisposals.${index}.currentValue`, v)
              }
              min={0}
              className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cash retained (%)
          </label>
          <input
            type="number"
            value={cashPct}
            onChange={(e) =>
              setValue(
                `assetDisposals.${index}.cashRetainedPct`,
                parseFloat(e.target.value) || 0,
              )
            }
            min={0}
            max={100}
            step={1}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Tx costs (%)
          </label>
          <input
            type="number"
            value={txPct}
            onChange={(e) =>
              setValue(
                `assetDisposals.${index}.txCostsPct`,
                parseFloat(e.target.value) || 0,
              )
            }
            min={0}
            max={100}
            step={0.5}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>
      {!totalsValid && (
        <div className="text-xs text-red-600">
          Cash retained + transaction costs must not exceed 100%.
        </div>
      )}
      {!ageValid && (
        <div className="text-xs text-red-600">
          Sale age must be between 18 and 120.
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={!totalsValid || !ageValid}
          className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Done
        </button>
      </div>
    </div>
  )
}
