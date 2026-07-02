import React, { useState } from "react"
import useSwr from "swr"
import type { RetirementPlan, WorkScenariosResponse } from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"

const WORK_SCENARIOS_URL = "/api/independence/work-scenarios"

interface CompositePlanSettingsCardProps {
  plans: RetirementPlan[]
}

export default function CompositePlanSettingsCard({
  plans,
}: CompositePlanSettingsCardProps): React.ReactElement {
  const { settings, updateSettings } = useIndependenceSettings()
  const { data: scenariosData } = useSwr<WorkScenariosResponse>(
    WORK_SCENARIOS_URL,
    simpleFetcher(WORK_SCENARIOS_URL),
  )
  const workScenarios = scenariosData?.data ?? []

  const currencies = Array.from(
    new Set(plans.map((p) => p.expensesCurrency).filter(Boolean)),
  )

  const [displayCurrency, setDisplayCurrencyLocal] = useState<string>(
    settings?.compositeDisplayCurrency ?? "",
  )
  const [workScenarioId, setWorkScenarioIdLocal] = useState<string>(
    settings?.compositeWorkScenarioId ?? "",
  )

  const seedSignature = `${settings?.compositeDisplayCurrency}:${settings?.compositeWorkScenarioId}`
  const [prevSeed, setPrevSeed] = useState(seedSignature)
  if (seedSignature !== prevSeed) {
    setPrevSeed(seedSignature)
    if (settings) {
      setDisplayCurrencyLocal(settings.compositeDisplayCurrency ?? "")
      setWorkScenarioIdLocal(settings.compositeWorkScenarioId ?? "")
    }
  }

  const handleCurrencyChange = async (
    currency: string,
  ): Promise<void> => {
    setDisplayCurrencyLocal(currency)
    await updateSettings({ compositeDisplayCurrency: currency })
  }

  const handleWorkScenarioChange = async (
    scenarioId: string,
  ): Promise<void> => {
    setWorkScenarioIdLocal(scenarioId)
    await updateSettings({ compositeWorkScenarioId: scenarioId || undefined })
  }

  if (currencies.length === 0 && workScenarios.length === 0) {
    return <></>
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg">
      <h3 className="text-base font-semibold text-gray-800 mb-4">
        <i className="fas fa-layer-group mr-2 text-independence-500"></i>
        Plan Display Settings
      </h3>
      <div className="space-y-4">
        {currencies.length > 0 && (
          <div>
            <label
              htmlFor="profile-composite-currency"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Display Currency
            </label>
            <select
              id="profile-composite-currency"
              value={displayCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 text-sm"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        {workScenarios.length > 0 && (
          <div>
            <label
              htmlFor="profile-composite-work-scenario"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Work Scenario
            </label>
            <select
              id="profile-composite-work-scenario"
              value={workScenarioId}
              onChange={(e) => handleWorkScenarioChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 text-sm"
            >
              <option value="">Current scenario</option>
              {workScenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
