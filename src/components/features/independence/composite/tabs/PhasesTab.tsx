import React, { useState } from "react"
import PhaseConfigList from "../../PhaseConfigList"
import PhaseTimeline, { resolvePhases } from "../PhaseTimeline"
import ResidencePhasePicker from "../ResidencePhasePicker"
import BenefitsStartPhasePicker from "../BenefitsStartPhasePicker"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"

const HIDDEN_VALUE = "****"

const PANEL_CLASS = "rounded-lg border border-gray-200 bg-white p-4"

/**
 * Phases tab — where a composite plan's shape is laid out.
 *
 * Reads top-down as one idea: the timeline band shows the years each phase
 * covers, the rows beneath it edit those years and carry each phase's own
 * narrative, and the levers panel holds the two decisions that land on a
 * phase boundary rather than a single age. Hovering a row lifts its timeline
 * segment and vice versa, so the map and the editor stay tied together.
 *
 * There is no composite-level narrative: the story of a composite plan is the
 * phases it runs through, each described on its own plan.
 */
export default function PhasesTab(): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const {
    plans,
    phases,
    setPhases,
    excludedPlanIds,
    toggleExclusion,
    projection,
    scenarios,
    isLoading,
    error,
  } = useCompositeProjectionContext()

  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // The last phase is open-ended ("end"); the projection is what resolves it
  // to a real horizon age, so borrow that once it has landed.
  const horizonAge = projection?.phases?.[projection.phases.length - 1]?.toAge
  const resolved = resolvePhases(phases, plans, horizonAge)
  const hasPhases = phases.length > 0

  return (
    <div className="space-y-4">
      <section className={PANEL_CLASS} data-testid="phases-layout">
        <PhaseTimeline
          resolved={resolved}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
        />
        <div className={hasPhases ? "mt-5" : ""}>
          <PhaseConfigList
            plans={plans}
            phases={phases}
            onPhaseChange={setPhases}
            onExclude={toggleExclusion}
            excludedPlanIds={excludedPlanIds}
            horizonAge={horizonAge}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
          />
        </div>
      </section>

      {hasPhases && (
        <section className={PANEL_CLASS} data-testid="phase-levers">
          <h3 className="text-sm font-medium text-gray-700">Phase levers</h3>
          <p className="mt-1 text-xs text-gray-500">
            Decisions that land on a phase boundary rather than a single age.
          </p>
          <div className="mt-2 divide-y divide-gray-100">
            <ResidencePhasePicker />
            <BenefitsStartPhasePicker />
          </div>
        </section>
      )}

      {isLoading && (
        <div className="py-8 text-center">
          <Spinner label="Calculating composite projection..." size="lg" />
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      {!isLoading && scenarios && scenarios.scenarios.length > 0 && (
        <section className={PANEL_CLASS}>
          <h3 className="text-sm font-medium text-gray-700">
            Scenario comparison
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="px-2 py-2">Scenario</th>
                  <th className="px-2 py-2 text-right">Runway (years)</th>
                  <th className="px-2 py-2 text-right">Depletion age</th>
                  <th className="px-2 py-2 text-center">Sustainable</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.scenarios.map((s) => (
                  <tr key={s.name} className="border-b border-gray-100">
                    <td className="px-2 py-2">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">
                        {s.description}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-700">
                      {hideValues
                        ? HIDDEN_VALUE
                        : s.projection.runwayYears.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-700">
                      {hideValues
                        ? HIDDEN_VALUE
                        : (s.projection.depletionAge ?? "Never")}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {s.projection.isSustainable ? (
                        <span className="font-medium text-gain">
                          <i aria-hidden="true" className="fas fa-check mr-1" />
                          Yes
                        </span>
                      ) : (
                        <span className="font-medium text-loss">
                          <i aria-hidden="true" className="fas fa-times mr-1" />
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
