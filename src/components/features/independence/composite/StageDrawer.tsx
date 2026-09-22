import React from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import type {
  CompositePhaseInfo,
  PhaseAssumptions,
  RetirementPlan,
} from "types/independence"
import { editPhaseHref } from "@lib/independence/editPhase"
import Alert from "@components/ui/Alert"
import type { ResolvedPhase } from "./PhaseTimeline"
import { phaseTone } from "./PhaseTimeline"
import {
  EffectiveRatesGrid,
  ProvenanceLabel,
  StageRateSwitch,
} from "./StageRateSource"
import type { StageRateSource } from "@hooks/useStageRateSource"

const ORDER_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-1 focus:ring-independence-500 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"

interface StageDrawerProps {
  id: string
  index: number
  phase: ResolvedPhase
  /** The stage's own plan, when loaded. Drives the switch and the narrative. */
  plan: RetirementPlan | undefined
  /** This stage's slice of the projection echo, when it has landed. */
  echo: (CompositePhaseInfo & { assumptions: PhaseAssumptions }) | undefined
  canMoveEarlier: boolean
  canMoveLater: boolean
  onMove: (direction: "earlier" | "later") => void
  rateSource: StageRateSource
}

/**
 * The open stage, beneath the band. Everything about a stage that is not
 * its shape lives here: which rates it runs on (and the switch to change
 * that), and its place in the order. The band above keeps the ages, so none
 * of them are repeated; the narrative stays on the stage's own page, one
 * link away, so the drawer reads at a glance.
 */
export default function StageDrawer({
  id,
  index,
  phase,
  plan,
  echo,
  canMoveEarlier,
  canMoveLater,
  onMove,
  rateSource,
}: StageDrawerProps): React.ReactElement {
  // Same normalisation as the stage wizard: a legacy row that never carried
  // the flag reads as inheriting, matching how svc-retire resolves it.
  const inherits = plan?.assumptionsInherited ?? true
  const error = rateSource.errorFor(phase.planId)

  const router = useRouter()

  return (
    <section
      id={id}
      aria-label={`${phase.planName} stage`}
      className="mt-4 border-t border-gray-100 pt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${phaseTone(index)}`}
          />
          <h4 className="min-w-0 truncate text-sm font-medium text-gray-900">
            {phase.planName}
          </h4>
          <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500">
            {phase.fromAge}–{phase.toAge} · {phase.years} yr
          </span>
        </div>
        {/* Whose rates: the choice (switch, from the stored plan) beside the
            answer (provenance, from the engine's echo). Never worked out
            here by comparing rate sets — a stage inheriting from a journey
            that states nothing still runs on its own figures. */}
        <div className="flex items-center gap-3">
          {echo && <ProvenanceLabel source={echo.assumptions.source} />}
          <span className="text-sm text-gray-700">Own rates</span>
          <StageRateSwitch
            label={`Own rates for ${phase.planName}`}
            inherits={inherits}
            disabled={!plan || rateSource.isSaving(phase.planId)}
            onChange={(next) => {
              if (plan) void rateSource.setInherits(plan, next)
            }}
          />
        </div>
      </div>

      <div className="mt-3 pl-5">
        {echo ? (
          <EffectiveRatesGrid assumptions={echo.assumptions} />
        ) : (
          <p className="text-xs text-gray-500">
            Rates show once the projection has run.
          </p>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-5">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onMove("earlier")}
            disabled={!canMoveEarlier}
            className={ORDER_BUTTON_CLASS}
            aria-label={`Move ${phase.planName} earlier`}
          >
            <i aria-hidden="true" className="fas fa-arrow-left text-xs" />
            Move earlier
          </button>
          <button
            type="button"
            onClick={() => onMove("later")}
            disabled={!canMoveLater}
            className={ORDER_BUTTON_CLASS}
            aria-label={`Move ${phase.planName} later`}
          >
            Move later
            <i aria-hidden="true" className="fas fa-arrow-right text-xs" />
          </button>
        </div>
        <Link
          href={editPhaseHref(phase.planId, router.asPath)}
          className="text-xs font-medium text-independence-700 underline-offset-2 hover:underline"
        >
          Edit stage
        </Link>
      </div>
    </section>
  )
}
