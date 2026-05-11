import React, { useState } from "react"
import { AssetDisposal } from "types/independence"
import MathInput from "@components/ui/MathInput"
import { usePrivateAssetConfigs } from "@lib/assets/usePrivateAssetConfigs"
import { useAssetValues } from "@lib/assets/useAssetValues"

interface QuickScenariosProps {
  appendDisposals: (disposals: AssetDisposal[]) => void
  defaultAge?: number
}

/**
 * Quick Scenarios — guided wizards that generate AssetDisposal records
 * for common what-if cases (e.g., selling and downsizing a property).
 *
 * The wizard hides the math: user describes the scenario in plain terms,
 * we emit a holding-bound AssetDisposal record. Backend converts that to
 * the three illiquid/liquid pool transfers and suppresses the disposed
 * asset's rental income from the chosen disposalAge onward.
 */
export default function QuickScenarios({
  appendDisposals,
  defaultAge,
}: QuickScenariosProps): React.ReactElement {
  const [openPreset, setOpenPreset] = useState<"downsize" | null>(null)

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-indigo-900">
          <i className="fas fa-magic mr-2"></i>
          Quick Scenarios
        </h3>
        <span className="text-xs text-indigo-700">
          Guided wizards for common life events
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setOpenPreset(openPreset === "downsize" ? null : "downsize")
          }
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
            openPreset === "downsize"
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100"
          }`}
        >
          <i className="fas fa-home mr-1"></i>
          Sell &amp; Downsize Property
        </button>
      </div>
      {openPreset === "downsize" && (
        <SellAndDownsizeForm
          defaultAge={defaultAge}
          onCancel={() => setOpenPreset(null)}
          onGenerate={(disposals) => {
            appendDisposals(disposals)
            setOpenPreset(null)
          }}
        />
      )}
    </div>
  )
}

interface SellAndDownsizeFormProps {
  defaultAge?: number
  onCancel: () => void
  onGenerate: (disposals: AssetDisposal[]) => void
}

function SellAndDownsizeForm({
  defaultAge,
  onCancel,
  onGenerate,
}: SellAndDownsizeFormProps): React.ReactElement {
  const [description, setDescription] = useState("Sell and downsize property")
  const [age, setAge] = useState<number>(defaultAge ?? 65)
  const [currentValue, setCurrentValue] = useState<number>(0)
  // Distinguishes user-typed edits from picker-driven autofills. Once true,
  // the picker stops overwriting the field on subsequent asset selections —
  // the user's explicit number wins. Picking a different asset BEFORE any
  // edit refreshes the autofill (reflecting the new asset's market value).
  const [isCurrentValueDirty, setIsCurrentValueDirty] = useState(false)
  const [cashRetainedPct, setCashRetainedPct] = useState<number>(50)
  const [txCostsPct, setTxCostsPct] = useState<number>(5)
  // assetId — picker UI lands in a follow-up that introduces a holdings
  // dropdown. For now users type a stable identifier so the disposal record
  // is well-formed and round-trips through the backend cleanly.
  const [assetId, setAssetId] = useState<string>("")

  // Preview math (engine derives the same splits server-side). Pure UX —
  // helps the user see where each fraction of the sale value ends up.
  const cashRetained = Math.max(0, currentValue * (cashRetainedPct / 100))
  const newPropertyValue = Math.max(
    0,
    currentValue * ((100 - cashRetainedPct - txCostsPct) / 100),
  )
  const txCostAmount = currentValue * (txCostsPct / 100)
  const ageValid = Number.isFinite(age) && age >= 18 && age <= 120
  const assetIdValid = assetId.trim().length > 0
  const totalsValid =
    cashRetainedPct + txCostsPct <= 100 &&
    currentValue > 0 &&
    ageValid &&
    assetIdValid

  const handleGenerate = (): void => {
    if (!totalsValid) return
    onGenerate([
      {
        assetId: assetId.trim(),
        disposalAge: age,
        currentValue,
        cashRetainedPct,
        txCostsPct,
        description: description.trim() || undefined,
        enabled: true,
      },
    ])
  }

  return (
    <div className="bg-white border border-indigo-300 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <AssetPicker
        assetId={assetId}
        onChange={(id, value) => {
          setAssetId(id)
          // Autofill from svc-retire on pick. Only overwrite when the user
          // hasn't typed a custom value yet — tracked explicitly via
          // isCurrentValueDirty so switching assets still refreshes the
          // autofill as long as the field hasn't been edited.
          if (value && value > 0 && !isCurrentValueDirty) {
            setCurrentValue(value)
          }
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Sale age
          </label>
          <input
            type="number"
            value={age || ""}
            onChange={(e) => setAge(parseInt(e.target.value) || 0)}
            min={18}
            max={120}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Current property value
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500 text-sm">
              $
            </span>
            <MathInput
              value={currentValue || ""}
              onChange={(v) => {
                setCurrentValue(v)
                setIsCurrentValueDirty(true)
              }}
              min={0}
              placeholder="e.g. 1m or 1000000"
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="mt-1 text-[10px] text-gray-400">
            Shorthand: 1m = 1,000,000, 1k = 1,000
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Free up as cash (%)
          </label>
          <input
            type="number"
            value={cashRetainedPct}
            onChange={(e) => setCashRetainedPct(parseFloat(e.target.value) || 0)}
            min={0}
            max={100}
            step={1}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Transaction costs (%)
          </label>
          <input
            type="number"
            value={txCostsPct}
            onChange={(e) => setTxCostsPct(parseFloat(e.target.value) || 0)}
            min={0}
            max={100}
            step={0.5}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {currentValue > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-1 text-xs text-gray-700">
          <div className="font-medium text-gray-900 mb-1">
            Preview at age {age}:
          </div>
          <div className="flex justify-between">
            <span>Sell existing property (illiquid out)</span>
            <span className="font-mono">
              -${currentValue.toLocaleString()}
            </span>
          </div>
          {newPropertyValue > 0 && (
            <div className="flex justify-between">
              <span>Buy replacement property (illiquid in)</span>
              <span className="font-mono">
                +${Math.round(newPropertyValue).toLocaleString()}
              </span>
            </div>
          )}
          {cashRetained > 0 && (
            <div className="flex justify-between text-blue-700">
              <span>Cash retained (liquid in)</span>
              <span className="font-mono">
                +${Math.round(cashRetained).toLocaleString()}
              </span>
            </div>
          )}
          {txCostAmount > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Transaction costs</span>
              <span className="font-mono">
                -${Math.round(txCostAmount).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {!ageValid && (
        <div className="text-xs text-red-600">
          Sale age must be between 18 and 120.
        </div>
      )}
      {ageValid &&
        !totalsValid &&
        currentValue > 0 &&
        cashRetainedPct + txCostsPct > 100 && (
          <div className="text-xs text-red-600">
            Cash retained + transaction costs must not exceed 100% of property
            value.
          </div>
        )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!totalsValid}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add events
        </button>
      </div>
    </div>
  )
}

interface AssetPickerProps {
  assetId: string
  /**
   * Fires when the selection changes. `value` is the autofilled current
   * market value (from svc-retire's `/assets/values`) when available;
   * `undefined` when no value is known (e.g. manual text entry, asset
   * not tracked in svc-position).
   */
  onChange: (assetId: string, value?: number) => void
}

/**
 * Asset picker for the Sell & Downsize wizard. Lists the user's tracked
 * private-asset configs (rental properties, primary residences), filtered
 * to non-pension assets. Pensions, CPF and composite policies are
 * disposal-incompatible — different cashflow semantics.
 *
 * On selection, looks up the asset's current market value via
 * `useAssetValues` so the wizard can autofill its currentValue field.
 */
function AssetPicker({
  assetId,
  onChange,
}: AssetPickerProps): React.ReactElement {
  const { configs, assetNames, isLoading } = usePrivateAssetConfigs()
  const { values: assetValues } = useAssetValues()
  const candidates = configs.filter((c) => !c.isPension)

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Asset to dispose of
      </label>
      {isLoading ? (
        <div className="px-3 py-2 text-xs text-gray-500 italic">
          Loading your assets…
        </div>
      ) : candidates.length === 0 ? (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 rounded border border-amber-200">
          No disposable assets configured. Add a property in the Assets tab,
          or enter an Asset ID manually below.
        </div>
      ) : (
        <select
          value={assetId}
          onChange={(e) => onChange(e.target.value, assetValues[e.target.value])}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">— Pick an asset —</option>
          {candidates.map((c) => {
            const name = assetNames[c.assetId] || c.assetId
            const tag = c.isPrimaryResidence ? " (primary)" : ""
            const value = assetValues[c.assetId]
            const valueLabel = value ? ` — $${Math.round(value).toLocaleString()}` : ""
            return (
              <option key={c.assetId} value={c.assetId}>
                {name}
                {tag}
                {valueLabel}
              </option>
            )
          })}
        </select>
      )}
      {/* Manual override — fallback when no tracked asset exists yet.
          No value lookup here: a manually typed assetId is for unknown
          / unregistered assets, and the wizard's currentValue field is
          left for the user to fill. */}
      <input
        type="text"
        value={assetId}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or type an asset id"
        className="mt-1 w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}
