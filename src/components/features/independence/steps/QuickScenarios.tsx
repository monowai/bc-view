import React, { useState } from "react"
import { LifeEvent } from "types/independence"
import MathInput from "@components/ui/MathInput"

interface QuickScenariosProps {
  appendEvents: (events: LifeEvent[]) => void
  defaultAge?: number
}

/**
 * Quick Scenarios — guided wizards that generate combinations of life events
 * to model common what-if cases (e.g., selling and downsizing a property).
 *
 * The wizard hides the math: user describes the scenario in plain terms,
 * we emit the paired liquid + illiquid life events that represent it
 * accurately in the projection engine.
 */
export default function QuickScenarios({
  appendEvents,
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
          onGenerate={(events) => {
            appendEvents(events)
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
  onGenerate: (events: LifeEvent[]) => void
}

function SellAndDownsizeForm({
  defaultAge,
  onCancel,
  onGenerate,
}: SellAndDownsizeFormProps): React.ReactElement {
  const [description, setDescription] = useState("Sell and downsize property")
  const [age, setAge] = useState<number>(defaultAge ?? 65)
  const [currentValue, setCurrentValue] = useState<number>(0)
  const [cashRetainedPct, setCashRetainedPct] = useState<number>(50)
  const [txCostsPct, setTxCostsPct] = useState<number>(5)

  // Conservation of value across the transaction:
  //   sale proceeds = cashRetained + replacementProperty + transactionCosts
  // cashRetainedPct is the user's "free up as cash" share of the sale;
  // txCostsPct is the share lost to fees / vapour; the remainder buys the
  // replacement property.
  const cashRetained = Math.max(0, currentValue * (cashRetainedPct / 100))
  const newPropertyValue = Math.max(
    0,
    currentValue * ((100 - cashRetainedPct - txCostsPct) / 100),
  )
  const txCostAmount = currentValue * (txCostsPct / 100)
  const ageValid = Number.isFinite(age) && age >= 18 && age <= 120
  const totalsValid =
    cashRetainedPct + txCostsPct <= 100 && currentValue > 0 && ageValid

  const handleGenerate = (): void => {
    if (!totalsValid) return
    const baseId = Date.now()
    const events: LifeEvent[] = [
      {
        id: `${baseId}-disposal`,
        age,
        amount: currentValue,
        description: `${description} — sell existing property`,
        eventType: "expense",
        assetType: "illiquid",
      },
      {
        id: `${baseId}-replacement`,
        age,
        amount: newPropertyValue,
        description: `${description} — buy replacement property`,
        eventType: "income",
        assetType: "illiquid",
      },
      {
        id: `${baseId}-cash`,
        age,
        amount: cashRetained,
        description: `${description} — cash retained`,
        eventType: "income",
        assetType: "liquid",
      },
    ]
    // Skip zero-amount legs (e.g., 100% cash retained → no replacement)
    onGenerate(events.filter((e) => e.amount > 0))
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
              onChange={(v) => setCurrentValue(v)}
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
