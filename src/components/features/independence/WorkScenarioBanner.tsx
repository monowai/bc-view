import React, { useState, useCallback } from "react"
import Link from "next/link"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import {
  WorkScenario,
  WorkScenarioRequest,
  WorkScenariosResponse,
} from "types/independence"
import ScenarioEditor from "./scenarios/ScenarioEditor"

const scenariosKey = "/api/independence/work-scenarios"

function computeContribution(scenario: WorkScenario): number {
  const income =
    (scenario.workingIncomeMonthly || 0) + (scenario.bonusMonthly || 0)
  const outgoings =
    (scenario.workingExpensesMonthly || 0) + (scenario.taxesMonthly || 0)
  const surplus = income - outgoings
  const pct = (scenario.investmentAllocationPercent || 0) / 100
  return Math.round(surplus * pct)
}

/**
 * Read-only banner showing the current work scenario, displayed above wizard steps.
 * Includes an "Edit" button that opens the ScenarioEditor modal inline.
 * If no scenarios exist, prompts the user to create one via the Scenarios tab.
 */
export default function WorkScenarioBanner(): React.ReactElement {
  const [editorOpen, setEditorOpen] = useState(false)

  const { data, isLoading, mutate } = useSwr<WorkScenariosResponse>(
    scenariosKey,
    simpleFetcher(scenariosKey),
  )

  const scenarios = data?.data || []
  const current = scenarios.find((s) => s.isCurrent)

  const handleSave = useCallback(
    async (formData: WorkScenarioRequest): Promise<void> => {
      if (!current) return
      const response = await fetch(`${scenariosKey}/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || "Failed to update scenario")
      }
      mutate()
      setEditorOpen(false)
    },
    [current, mutate],
  )

  if (isLoading) {
    return <></>
  }

  if (!current) {
    return (
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fas fa-exclamation-triangle text-amber-500"></i>
          <span className="text-sm text-amber-800">
            No work scenario selected. Create one to model your working-phase
            income and expenses.
          </span>
        </div>
        <Link
          href="/independence?view=work"
          className="text-sm font-medium text-independence-600 hover:text-independence-700 whitespace-nowrap ml-3"
        >
          Go to Work <i className="fas fa-arrow-right ml-1"></i>
        </Link>
      </div>
    )
  }

  const contribution = computeContribution(current)

  return (
    <>
      <div className="mb-4 bg-independence-50 border border-independence-100 rounded-lg px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-independence-700">
              <i className="fas fa-briefcase mr-1.5"></i>
              {current.name}
            </span>
            <span className="text-gray-500">
              Income{" "}
              <span className="font-medium text-gray-700">
                {current.currency}{" "}
                {(current.workingIncomeMonthly || 0).toLocaleString()}
              </span>
            </span>
            <span className="text-gray-500">
              Net contribution{" "}
              <span
                className={`font-medium ${contribution >= 0 ? "text-independence-600" : "text-red-600"}`}
              >
                {current.currency} {Math.abs(contribution).toLocaleString()}
                {contribution < 0 ? " (deficit)" : ""}
              </span>
            </span>
          </div>
          <button
            onClick={() => setEditorOpen(true)}
            className="text-sm font-medium text-independence-600 hover:text-independence-700"
          >
            <i className="fas fa-pen mr-1"></i>
            Edit
          </button>
        </div>
      </div>

      {editorOpen && (
        <ScenarioEditor
          scenario={current}
          onSave={handleSave}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </>
  )
}
