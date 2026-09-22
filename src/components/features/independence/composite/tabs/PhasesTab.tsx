import React, { useId, useState } from "react"
import type { CompositePhaseInfo, PhaseAssumptions } from "types/independence"
import PhaseTimeline, { resolvePhases } from "../PhaseTimeline"
import StageDrawer from "../StageDrawer"
import PlanInclusionChips from "../PlanInclusionChips"
import ResidencePhasePicker from "../ResidencePhasePicker"
import BenefitsStartPhasePicker from "../BenefitsStartPhasePicker"
import DisplayCurrencyPicker from "../../DisplayCurrencyPicker"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useStageRateSource } from "@hooks/useStageRateSource"
import { movePhase, setBoundaryAge } from "@utils/independence/phaseEdits"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"

const HIDDEN_VALUE = "****"

const PANEL_CLASS = "rounded-lg border border-gray-200 bg-white p-4"

/**
 * Stages tab — where a journey's shape is laid out.
 *
 * One surface, not two. The band is the map and the editor of the years:
 * each stage's start age sits on the seam it moves. Pressing a stage opens
 * its drawer beneath the band for everything that is not a year — what the
 * stage is for, whose rates it runs on, its place in the order. The levers
 * panel below holds the decisions that land on a stage boundary rather than
 * a single age.
 *
 * There is no composite-level narrative: the story of a journey is the
 * stages it runs through, each described on its own plan.
 */
export default function PhasesTab(): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const {
    plans,
    phases,
    setPhases,
    displayCurrency,
    setDisplayCurrency,
    excludedPlanIds,
    toggleExclusion,
    projection,
    scenarios,
    isLoading,
    error,
    refreshProjection,
  } = useCompositeProjectionContext()

  // The first stage opens by default: the drawer is where a stage explains
  // itself, and a page that opens on nothing explains nothing.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0)
  const drawerId = useId()
  const rateSource = useStageRateSource(refreshProjection)

  // The last phase is open-ended ("end"); the projection is what resolves it
  // to a real horizon age, so borrow that once it has landed.
  const horizonAge = projection?.phases?.[projection.phases.length - 1]?.toAge
  const resolved = resolvePhases(phases, plans, horizonAge)
  const hasPhases = phases.length > 0

  // Reordering or excluding can leave the selection past the end; clamp
  // rather than show a drawer for a stage that is no longer there.
  const openIndex =
    selectedIndex != null && selectedIndex < resolved.length
      ? selectedIndex
      : null
  const open = openIndex != null ? resolved[openIndex] : undefined

  // This stage's slice of the engine's echo. A stage the echo says nothing
  // about gets no provenance claim: the drawer says what the projection did,
  // not what the stored rates happen to look like.
  const openEcho = open
    ? (projection?.phases ?? []).find(
        (p): p is CompositePhaseInfo & { assumptions: PhaseAssumptions } =>
          p.planId === open.planId && p.assumptions != null,
      )
    : undefined

  return (
    <div className="space-y-4">
      <section className={PANEL_CLASS} data-testid="phases-layout">
        <PlanInclusionChips
          plans={plans}
          excludedPlanIds={excludedPlanIds}
          onToggle={toggleExclusion}
        />

        {hasPhases ? (
          <div className={plans.length > 1 ? "mt-4" : ""}>
            <PhaseTimeline
              resolved={resolved}
              selectedIndex={openIndex}
              onSelect={setSelectedIndex}
              onBoundaryChange={(boundary, age) =>
                setPhases(setBoundaryAge(phases, boundary, age))
              }
              drawerId={drawerId}
            />
            {open && openIndex != null && (
              <StageDrawer
                id={drawerId}
                index={openIndex}
                phase={open}
                plan={plans.find((p) => p.id === open.planId)}
                echo={openEcho}
                canMoveEarlier={openIndex > 0}
                canMoveLater={openIndex < resolved.length - 1}
                onMove={(direction) => {
                  setPhases(movePhase(phases, openIndex, direction))
                  // Follow the stage to its new place so the drawer keeps
                  // describing what the user just moved.
                  setSelectedIndex(
                    direction === "earlier" ? openIndex - 1 : openIndex + 1,
                  )
                }}
                rateSource={rateSource}
              />
            )}
          </div>
        ) : (
          <div className="py-12 text-center">
            <i
              aria-hidden="true"
              className="fas fa-clipboard-list text-4xl text-gray-300"
            ></i>
            <p className="mt-3 text-lg text-gray-500">No stages yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Include at least one plan above to lay out the years it covers.
            </p>
          </div>
        )}
      </section>

      {hasPhases && (
        <section className={PANEL_CLASS} data-testid="phase-levers">
          <h3 className="text-sm font-medium text-gray-700">Phase levers</h3>
          <p className="mt-1 text-xs text-gray-500">
            Decisions that land on a phase boundary rather than a single age.
          </p>
          <div className="mt-2 divide-y divide-gray-100">
            <DisplayCurrencyPicker
              plans={plans}
              value={displayCurrency}
              onChange={setDisplayCurrency}
            />
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
