import React, { useMemo, useRef, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { editPhaseHref } from "@lib/independence/editPhase"
import useSwr from "swr"
import {
  simpleFetcher,
  fetcher,
  holdingKey,
  resourceSharesPendingKey,
  resourceSharesManagedKey,
} from "@utils/api/fetchHelper"
import {
  PlansResponse,
  RetirementPlan,
  PlanExport,
  WorkScenariosResponse,
} from "types/independence"
import {
  HoldingContract,
  PendingResourceSharesResponse,
  ResourceSharesResponse,
} from "types/beancounter"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import { useActiveIndependencePlan } from "@hooks/useIndependencePlans"
import { sortPlansByCompositeOrder } from "@lib/independence/planOrdering"
import {
  isJourneyPhased,
  journeyPhasePlans,
  landingPlan,
} from "@lib/independence/journeyPhases"
import { pickHeadlineGauge } from "@utils/independence/headlineGauge"
import {
  useAssetBreakdown,
  useFiProjectionSimple,
  AssetBreakdown,
} from "@components/features/independence"
import CompositeTab from "@components/features/independence/CompositeTab"
import IndependencePlanSwitcher from "@components/features/independence/IndependencePlanSwitcher"
import GeneratePhasesOffer from "@components/features/independence/GeneratePhasesOffer"
import IndependenceSettingsPanel from "@components/features/independence/IndependenceSettingsPanel"
import ResourceShareInviteDialog from "@components/features/shares/ResourceShareInviteDialog"
import PendingResourceSharesPanel from "@components/features/shares/PendingResourceSharesPanel"
import Alert from "@components/ui/Alert"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import ActionMenu from "@components/ui/ActionMenu"

const plansKey = "/api/independence/plans"
const HIDDEN_VALUE = "****"

/**
 * Two destinations, not five tabs.
 *
 * The page used to offer Plan / Work / Phases / Shared / Profile in one row,
 * with seven more sub-tabs underneath — and nothing on screen said which of
 * them would show you an answer and which would quietly change one. Reading
 * the plan is now one destination; everything that edits it is the other.
 */
type PageView = "plan" | "setup" | "shared"

/**
 * Where "Add a stage" goes, carrying the journey it was pressed from.
 *
 * A stage belongs to one journey and the wizard can only stamp the one it is
 * told about, so the parameter is not decoration: without it the stage lands
 * ungrouped, which shows it in *every* journey's stage list (`phaseTabPlans`).
 * Omitted only when there is no journey to belong to yet.
 */
function addStageHref(journeyId: string | undefined): string {
  return journeyId
    ? `/independence/wizard?plan=${encodeURIComponent(journeyId)}`
    : "/independence/wizard"
}

type SetupSectionId = "stages" | "assumptions" | "wealth" | "work" | "profile"

interface SetupSection {
  id: SetupSectionId
  label: string
  hint: string
  icon: string
}

/**
 * Which Set up section a `?view=` value names, or null if it names none.
 *
 * Every view that used to be its own tab still resolves, so old links and
 * bookmarks keep working after the collapse to two destinations.
 */
function setupSectionFor(view: unknown): SetupSectionId | null {
  switch (view) {
    case "profile":
      return "profile"
    case "work":
      return "work"
    case "stages":
    // Legacy: both of these named a tab of their own before the collapse.
    case "phases":
    case "plans":
      return "stages"
    case "wealth":
      return "wealth"
    case "assumptions":
      return "assumptions"
    default:
      return null
  }
}

/** Which destination a `?view=` value names. Anything unrecognised reads the plan. */
function resolvePageView(view: unknown): PageView {
  if (setupSectionFor(view) != null) return "setup"
  if (view === "shared") return "shared"
  return "plan"
}

const SETUP_SECTIONS: SetupSection[] = [
  {
    id: "stages",
    label: "Stages",
    hint: "The ages each stage covers, and what changes between them.",
    icon: "fa-clipboard-list",
  },
  {
    id: "assumptions",
    label: "Assumptions",
    hint: "Return rates, inflation, fees and tax — set once here; every stage inherits them unless it overrides.",
    icon: "fa-sliders-h",
  },
  {
    id: "wealth",
    label: "What counts as wealth",
    hint: "Which portfolios this plan draws on, and how each one is treated.",
    icon: "fa-wallet",
  },
  {
    id: "work",
    label: "Working years",
    hint: "What you earn and spend before you stop working.",
    icon: "fa-briefcase",
  },
  {
    id: "profile",
    label: "About you",
    hint: "Your age and how long to plan for. Every projection rests on these.",
    icon: "fa-user",
  },
]

// Plan card component that uses shared assets for consistent FI calculation
function PlanCard({
  plan,
  assets,
  hideValues,
  onDelete,
  onExport,
  onCopy,
  onSetPrimary,
  isSharedPlan = false,
  onLeaveShare,
}: {
  plan: RetirementPlan
  assets: AssetBreakdown
  hideValues: boolean
  onDelete: (planId: string) => void
  onExport: (plan: RetirementPlan) => void
  onCopy: (plan: RetirementPlan) => void
  onSetPrimary: (planId: string) => void
  /** Plan is on the Shared tab — viewer doesn't own it. */
  isSharedPlan?: boolean
  /** Triggered when viewer revokes their own access; receives planId. */
  onLeaveShare?: (planId: string) => void
}): React.ReactElement {
  // Its own router: the card is a module-level component, and the edit link
  // has to carry the reader's current location so the wizard can hand it back.
  const router = useRouter()
  // Use unified projection hook with shared assets
  const { projection, isLoading: fiLoading } = useFiProjectionSimple({
    plan,
    assets,
  })

  const currency = plan.expensesCurrency || "$"

  // Get rental income from projection (backend fetches from svc-data)
  const rentalIncomeMonthly = projection?.planInputs?.rentalIncomeMonthly ?? 0

  // Calculate net monthly expenses (same as projection page)
  // Net = Expenses - All Income Sources (including rental income)
  const totalMonthlyIncome =
    (plan.pensionMonthly || 0) +
    (plan.socialSecurityMonthly || 0) +
    (plan.otherIncomeMonthly || 0) +
    rentalIncomeMonthly
  const gauge = pickHeadlineGauge(
    projection?.effectiveHeadlineMetric,
    projection?.fiMetrics ?? undefined,
  )
  const fallbackGauge = pickHeadlineGauge(plan.headlineMetric, undefined)

  const getProgressBgColor = (progress: number): string => {
    if (progress >= 100) return "bg-green-500"
    if (progress >= 75) return "bg-blue-500"
    if (progress >= 50) return "bg-yellow-500"
    return "bg-independence-500"
  }

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
            {plan.isPrimary && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-independence-100 text-independence-700">
                <i className="fas fa-star text-independence-500 mr-1 text-[10px]"></i>
                Primary
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {plan.planningHorizonYears} year horizon
            {plan.expensesCurrency && ` · ${plan.expensesCurrency}`}
          </p>
        </div>
        <div className="flex items-center space-x-1">
          {isSharedPlan ? (
            <button
              onClick={() => onLeaveShare?.(plan.id)}
              className="text-red-600 hover:text-red-900 p-1.5 mr-1"
              title="Revoke your access to this shared plan"
            >
              <i className="fas fa-sign-out-alt text-xs"></i>
            </button>
          ) : (
            <>
              <button
                onClick={() => onDelete(plan.id)}
                className="text-red-600 hover:text-red-900 p-1.5 mr-1"
                title="Delete plan"
              >
                <i className="fas fa-trash text-xs"></i>
              </button>
              <button
                onClick={() => onCopy(plan)}
                className="text-gray-400 hover:text-gray-600 p-1.5"
                title="Copy plan"
              >
                <i className="fas fa-copy text-xs"></i>
              </button>
              <button
                onClick={() => onExport(plan)}
                className="text-gray-400 hover:text-gray-600 p-1.5"
                title="Export plan as JSON"
              >
                <i className="fas fa-download text-xs"></i>
              </button>
              {!plan.isPrimary && (
                <button
                  onClick={() => onSetPrimary(plan.id)}
                  className="text-gray-400 hover:text-independence-600 p-1.5"
                  title="Set as primary plan"
                >
                  <i className="fas fa-star text-xs"></i>
                </button>
              )}
              <Link
                href={editPhaseHref(plan.id, router.asPath)}
                className="!text-green-600 hover:!text-green-900 p-1.5"
                title="Edit plan"
              >
                <i className="fas fa-edit"></i>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Headline metric — mirrors what the plan drill-down shows */}
      <div className="bg-independence-50 rounded-lg p-3 mb-4 border border-independence-100">
        {fiLoading ? (
          <div className="flex items-center text-xs text-gray-400">
            <Spinner label="Calculating..." />
          </div>
        ) : projection?.fiMetrics ? (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                <i className="fas fa-bullseye text-independence-500 mr-1"></i>
                {gauge.label}
              </span>
              <span
                className={`font-bold tabular-nums ${hideValues ? "text-gray-400" : "text-independence-600"}`}
              >
                {hideValues ? HIDDEN_VALUE : gauge.display}
              </span>
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBgColor(gauge.fillPercent)} transition-all duration-500`}
                  style={{
                    width: hideValues ? "0%" : `${gauge.fillPercent}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{gauge.byline}</p>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              <i className="fas fa-bullseye text-independence-500 mr-1"></i>
              {fallbackGauge.label}
            </span>
            <span className="text-xs text-gray-500">Not yet projected</span>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Monthly Expenses</span>
          <span className={`font-medium ${hideValues ? "text-gray-400" : ""}`}>
            {hideValues
              ? HIDDEN_VALUE
              : `${currency}${plan.monthlyExpenses.toLocaleString()}`}
          </span>
        </div>
        {totalMonthlyIncome > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              Monthly Income
              {rentalIncomeMonthly > 0 && (
                <span className="text-xs text-gray-400 ml-1">
                  (incl. rental)
                </span>
              )}
            </span>
            <span
              className={`font-medium text-green-600 ${hideValues ? "text-gray-400" : ""}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${currency}${Math.round(totalMonthlyIncome).toLocaleString()}`}
            </span>
          </div>
        )}
        {plan.targetBalance && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Target Balance</span>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${currency}${plan.targetBalance.toLocaleString()}`}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Expected Return</span>
          <span className="font-medium">
            {(plan.equityReturnRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <Link
        href={`/independence/plans/${plan.id}`}
        className="w-full block text-center bg-independence-600 text-white px-4 py-2 rounded-lg hover:bg-independence-700 font-medium transition-colors"
      >
        Projections
      </Link>
    </div>
  )
}

function RetirementPlanning(): React.ReactElement {
  const router = useRouter()
  const { hideValues } = usePrivacyMode()
  const { settings, mutateSettings } = useIndependenceSettings()
  // The journey being viewed — `?plan=<id>`, else the default, else the
  // first by name. Owns the composite config the Plan tab reads and writes.
  const {
    activePlan: activeJourney,
    activePlanId,
    isLoading: journeysLoading,
    mutate: mutateJourneys,
  } = useActiveIndependencePlan()
  const { data: scenariosData } = useSwr<WorkScenariosResponse>(
    "/api/independence/work-scenarios",
    simpleFetcher("/api/independence/work-scenarios"),
  )
  const hasNoWorkScenarios =
    scenariosData !== undefined && (scenariosData.data?.length ?? 0) === 0
  // Critical profile defaults that must be set for a meaningful projection.
  // None are seeded with a fake value, so "missing" means the user hasn't
  // chosen one yet — flag the Profile tab red until they have.
  const profileIncomplete =
    settings !== undefined &&
    (!settings.yearOfBirth ||
      !settings.monthOfBirth ||
      !settings.targetIndependenceAge ||
      !settings.lifeExpectancy)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Deep links keep working after the collapse from five views to two
  // destinations: everything that used to be its own tab is now a section of
  // Set up, so `?view=profile` lands on Set up with Profile selected.
  // The URL owns which destination is showing, rather than local state.
  // Holding it in state meant a `?view=` link into this page — including the
  // "Set up your stages" button on an empty plan — changed the address bar
  // and nothing else, because the component never remounts on a query-only
  // navigation. Deriving it also makes a destination shareable and the back
  // button work.
  const requestedView = router.query.view
  const setupSection = setupSectionFor(requestedView) ?? "stages"
  const activeView = resolvePageView(requestedView)

  const goTo = (view: PageView | SetupSectionId): void => {
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, view } },
      undefined,
      { shallow: true },
    )
  }
  const setActiveView = (view: PageView): void =>
    goTo(view === "setup" ? setupSection : view)
  const setSetupSection = goTo
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)
  const [copyPlan, setCopyPlan] = useState<RetirementPlan | null>(null)
  const [copyName, setCopyName] = useState("")
  const [isGeneratingPhases, setIsGeneratingPhases] = useState(false)
  const [generatePhasesError, setGeneratePhasesError] = useState<string | null>(
    null,
  )

  const { data, error, isLoading, mutate } = useSwr<PlansResponse>(
    plansKey,
    simpleFetcher(plansKey),
  )

  // Pending INDEPENDENCE_PLAN invites/requests so users can accept shares
  // from inside the page where the shared plan will land — without this the
  // SharesBadge counts INDEPENDENCE_PLAN invites but has no accept surface
  // (ManagedPortfolios only renders PORTFOLIO shares).
  const { data: pendingResourceShares, mutate: mutatePendingResourceShares } =
    useSwr<PendingResourceSharesResponse>(resourceSharesPendingKey, fetcher, {
      refreshInterval: 300000,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    })

  const handlePendingResourceSharesAction = (): void => {
    mutatePendingResourceShares()
    mutate()
  }

  // Map shared INDEPENDENCE_PLAN ids → shareId so the viewer can revoke
  // their own access via DELETE /resource-shares/{shareId}. The owner has
  // a separate "active shares" surface elsewhere; this hook is purely for
  // viewer-side leave actions.
  const managedIndependencePlanKey =
    resourceSharesManagedKey("INDEPENDENCE_PLAN")
  const {
    data: managedIndependencePlans,
    mutate: mutateManagedIndependencePlans,
  } = useSwr<ResourceSharesResponse>(
    managedIndependencePlanKey,
    simpleFetcher(managedIndependencePlanKey),
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const sharedPlanShareIdByPlanId = useMemo(() => {
    const map = new Map<string, string>()
    for (const share of managedIndependencePlans?.data ?? []) {
      if (share.resourceId && share.id) map.set(share.resourceId, share.id)
    }
    return map
  }, [managedIndependencePlans])

  const [leavePlanId, setLeavePlanId] = useState<string | null>(null)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const handleLeaveSharedPlan = async (planId: string): Promise<void> => {
    const shareId = sharedPlanShareIdByPlanId.get(planId)
    if (!shareId) {
      setLeaveError(
        "Cannot revoke access — share record not loaded. Refresh and try again.",
      )
      return
    }
    try {
      const res = await fetch(`/api/resource-shares/${shareId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const body = await res.text()
        setLeaveError(body || `Revoke failed (${res.status})`)
        return
      }
      setLeavePlanId(null)
      setLeaveError(null)
      await Promise.all([mutate(), mutateManagedIndependencePlans()])
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : "Revoke failed")
    }
  }

  // Fetch aggregated holdings once at page level for consistent FI calculation across all plans
  // Use SWR caching to persist across refreshes (revalidateOnFocus: false)
  const holdingKeyUrl = holdingKey("aggregated", "today")
  const { data: holdingsResponse, isLoading: holdingsLoading } = useSwr<{
    data: HoldingContract
  }>(holdingKeyUrl, simpleFetcher(holdingKeyUrl), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // Cache for 60 seconds
  })

  // Calculate asset breakdown from holdings (shared across all PlanCards)
  // Only calculate when holdings have finished loading
  const holdingsData = holdingsLoading ? undefined : holdingsResponse?.data
  const assets = useAssetBreakdown(holdingsData)

  // Backend returns plans sorted primary-first-then-by-name. Once the user
  // has configured a composite, we re-order so plans follow the sequence
  // they've defined on the Composite tab — a timeline like Singapore → NZ →
  // Thailand should show those cards in that order everywhere. Plans not in
  // the composite retain their backend order behind the sequenced ones.
  const sharedPlanIdSet = useMemo(
    () => new Set(data?.sharedPlanIds ?? []),
    [data?.sharedPlanIds],
  )
  const allPlans = sortPlansByCompositeOrder(data?.data || [], settings)
  const ownedPlans = allPlans.filter((p) => !sharedPlanIdSet.has(p.id))
  const sharedPlans = allPlans.filter((p) => sharedPlanIdSet.has(p.id))
  // Backwards-compatible alias — most code below refers to the user's own
  // plans; sharing UI references sharedPlans directly.
  const plans = ownedPlans

  // "Phased" belongs to the plan being viewed, not to a count of rows: a user
  // who owns "with property" and "renting" has six phase plans between them
  // while either plan on its own may still be a single unphased row.
  const activeJourneyPhased = isJourneyPhased(activeJourney)
  const activeJourneyPlans = journeyPhasePlans(activeJourney, ownedPlans)
  // The Phases tab lists the phases of the plan being viewed. Listing every
  // owned row showed both plans' phases side by side — after duplicating
  // "with property" into "renting" that is the same three names twice, with
  // no way to tell which belongs to which. Ungrouped rows stay visible so a
  // legacy plan that predates the grouping column cannot become unreachable.
  // Plain derivation, not useMemo: its inputs are themselves per-render
  // derivations, so a manual memo here cannot be preserved and costs the whole
  // component its React Compiler optimization.
  const ungroupedPlans = ownedPlans.filter((p) => !p.independencePlanId)
  const phaseTabPlans = !activeJourney
    ? ownedPlans
    : [
        ...activeJourneyPlans,
        ...ungroupedPlans.filter(
          (u) => !activeJourneyPlans.some((a) => a.id === u.id),
        ),
      ]

  // The row this plan would be phased from — only while it has no composite
  // of its own to clobber.
  //
  // With no journey at all there is nothing for `activeJourneyPlans` to be
  // scoped to, so it is empty and sourcing the candidate from it withheld the
  // offer entirely — a legacy user with ungrouped rows and no journey lost an
  // affordance they used to have. `phaseTabPlans` is what that user is
  // actually looking at, so phase from what is on screen.
  const phasingCandidates = activeJourney ? activeJourneyPlans : phaseTabPlans
  const planToPhase = activeJourneyPhased
    ? undefined
    : landingPlan(phasingCandidates)

  // Reading the plan needs a phased plan to read. Until there is one, Set up
  // is the honest destination — it's where the stages get created. While
  // either request is in flight, honour the stored view so we don't flash to
  // Set up and back.
  const planReadable = activeJourneyPhased
  const effectiveView: PageView =
    activeView === "plan" && !isLoading && !journeysLoading && !planReadable
      ? "setup"
      : activeView
  const effectiveSection: SetupSectionId =
    effectiveView === "setup" && activeView === "plan" ? "stages" : setupSection

  const handleExportPlan = async (plan: RetirementPlan): Promise<void> => {
    try {
      const response = await fetch(`/api/independence/plans/${plan.id}/export`)
      if (!response.ok) return
      const result = await response.json()
      const exportData = result.data
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })
      const fileName = `${plan.name.replace(/[^a-z0-9]/gi, "_")}_retirement_plan.json`

      const downloadFallback = (): void => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      // Use native Save As dialog when available, fall back to auto-download
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (
            window as never as {
              showSaveFilePicker: (
                opts: Record<string, unknown>,
              ) => Promise<FileSystemFileHandle>
            }
          ).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: "JSON",
                accept: { "application/json": [".json"] },
              },
            ],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
        } catch (pickerErr) {
          // User cancelled — do nothing; any other failure — use fallback
          if (
            pickerErr instanceof DOMException &&
            pickerErr.name === "AbortError" &&
            pickerErr.message.includes("user aborted")
          )
            return
          downloadFallback()
        }
      } else {
        downloadFallback()
      }
    } catch (err) {
      console.error("Failed to export plan:", err)
    }
  }

  const handleDeletePlanConfirm = async (): Promise<void> => {
    if (!deletePlanId) return
    try {
      await fetch(`/api/independence/plans/${deletePlanId}`, {
        method: "DELETE",
      })
      mutate()
    } catch (err) {
      console.error("Failed to delete plan:", err)
    } finally {
      setDeletePlanId(null)
    }
  }

  const handleImportClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportError(null)

    const cleanup = (): void => {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }

    const text = await file.text()
    let planData: PlanExport

    // Try to parse as JSON
    try {
      planData = JSON.parse(text)
    } catch {
      setImportError("Invalid file format. Please select a valid JSON file.")
      cleanup()
      return
    }

    // Validate required fields
    if (!planData.name || !planData.planningHorizonYears) {
      setImportError(
        "Invalid plan file. Missing required fields (name, planningHorizonYears).",
      )
      cleanup()
      return
    }

    // Import the plan
    try {
      const response = await fetch("/api/independence/plans/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setImportError(errorData.message || "Failed to import plan")
        cleanup()
        return
      }

      const result = await response.json()
      mutate() // Refresh the plans list
      router.push(`/independence/plans/${result.data.id}`)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to import plan"
      setImportError(message)
    } finally {
      cleanup()
    }
  }

  const handleCopyClick = (plan: RetirementPlan): void => {
    setCopyPlan(plan)
    setCopyName(`${plan.name} (Copy)`)
  }

  const handleCopyConfirm = async (): Promise<void> => {
    if (!copyPlan || !copyName.trim()) return
    try {
      const response = await fetch(
        `/api/independence/plans/${copyPlan.id}/copy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: copyName.trim() }),
        },
      )
      if (response.ok) {
        mutate()
      }
    } catch (err) {
      console.error("Failed to copy plan:", err)
    } finally {
      setCopyPlan(null)
    }
  }

  const handleSetPrimary = async (planId: string): Promise<void> => {
    try {
      const response = await fetch(
        `/api/independence/plans/${planId}/primary`,
        { method: "POST" },
      )
      if (response.ok) {
        mutate()
      }
    } catch (err) {
      console.error("Failed to set primary:", err)
    }
  }

  const handleGeneratePhases = async (): Promise<void> => {
    if (!planToPhase || !activePlanId) return
    setIsGeneratingPhases(true)
    setGeneratePhasesError(null)
    try {
      const response = await fetch(
        `/api/independence/plans/${planToPhase.id}/phases`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Name the plan being phased. The backend refuses per plan now, and
          // the offer only shows for a plan with no composite, so there is
          // nothing here to overwrite — `force` would only put a tuned
          // composite on another plan at risk.
          body: JSON.stringify({ independencePlanId: activePlanId }),
        },
      )
      if (!response.ok) {
        const body = await response.text()
        setGeneratePhasesError(
          body || `Failed to generate phases (${response.status})`,
        )
        return
      }
      // The journey carries the composite the Plan tab gates on, so revalidate
      // it too — otherwise the new phases exist but nothing on screen moves.
      await Promise.all([mutate(), mutateSettings(), mutateJourneys()])
    } catch (err) {
      setGeneratePhasesError(
        err instanceof Error ? err.message : "Failed to generate phases",
      )
    } finally {
      setIsGeneratingPhases(false)
    }
  }

  return (
    <>
      <Head>
        <title>Independence Planning | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* The header carries journey-level actions only — stage actions live
              with the stage list, under Set up. The destination tabs are this
              page's call to action, so there is no primary button here. */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Your independence plan
              </h1>
              <p className="mt-1 max-w-prose text-gray-600">
                Where your money takes you, and when.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".json"
                className="hidden"
              />
              <ActionMenu
                label="Plan options"
                items={[
                  ...(plans.length > 0
                    ? [
                        {
                          label: "Share this plan",
                          icon: "fa-share-alt",
                          onSelect: () => setShowShareDialog(true),
                        },
                      ]
                    : []),
                  {
                    label: isImporting ? "Importing…" : "Import a plan file",
                    icon: "fa-upload",
                    disabled: isImporting,
                    onSelect: handleImportClick,
                  },
                  ...(process.env.NODE_ENV === "development"
                    ? [
                        {
                          label: "Debug projections",
                          icon: "fa-bug",
                          onSelect: () => router.push("/independence/debug"),
                        },
                      ]
                    : []),
                ]}
                triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-independence-500 motion-reduce:transition-none"
              />
            </div>
          </div>

          {importError && (
            <div className="mb-6">
              <Alert>
                <div className="flex justify-between items-center">
                  <span>{importError}</span>
                  <button
                    onClick={() => setImportError(null)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </Alert>
            </div>
          )}

          <IndependencePlanSwitcher />

          {/* Two destinations: read the plan, or change it. */}
          <div className="mb-6 flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {activeJourneyPhased && (
              <button
                type="button"
                aria-current={effectiveView === "plan" ? "page" : undefined}
                onClick={() => setActiveView("plan")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                  effectiveView === "plan"
                    ? "bg-white text-independence-700 shadow-sm dark:bg-gray-900 dark:text-independence-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                <i aria-hidden="true" className="fas fa-chart-line mr-2" />
                Your plan
              </button>
            )}
            <button
              type="button"
              aria-current={effectiveView === "setup" ? "page" : undefined}
              onClick={() => setActiveView("setup")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                effectiveView === "setup"
                  ? "bg-white text-independence-700 shadow-sm dark:bg-gray-900 dark:text-independence-300"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              }`}
            >
              <i aria-hidden="true" className="fas fa-sliders-h mr-2" />
              Set up
              {(profileIncomplete || hasNoWorkScenarios) && (
                <span
                  className={`ml-1.5 inline-block h-2 w-2 rounded-full ${
                    profileIncomplete ? "bg-red-500" : "bg-amber-400"
                  }`}
                  aria-label={
                    profileIncomplete
                      ? "Something needed is missing"
                      : "Something is worth filling in"
                  }
                />
              )}
            </button>
            {sharedPlans.length > 0 && (
              <button
                type="button"
                aria-current={effectiveView === "shared" ? "page" : undefined}
                onClick={() => setActiveView("shared")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                  effectiveView === "shared"
                    ? "bg-white text-independence-700 shadow-sm dark:bg-gray-900 dark:text-independence-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                <i aria-hidden="true" className="fas fa-share-alt mr-2" />
                Shared with you
                <span className="ml-1.5 text-xs text-gray-500">
                  ({sharedPlans.length})
                </span>
              </button>
            )}
          </div>

          {pendingResourceShares && (
            <PendingResourceSharesPanel
              pending={pendingResourceShares}
              resourceType="INDEPENDENCE_PLAN"
              onAction={handlePendingResourceSharesAction}
            />
          )}

          {isLoading && (
            <div className="text-center py-12">
              <Spinner label="Loading plans..." size="lg" />
            </div>
          )}

          {error && <Alert>Failed to load plans. Please try again.</Alert>}

          {/* ——— Set up: everything that changes the plan ———
              A vertical rail, deliberately unlike the horizontal row the
              reading surface uses, so settings never look like answers. */}
          {effectiveView === "setup" && (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <nav
                aria-label="Plan settings"
                className="shrink-0 lg:sticky lg:top-4 lg:w-56"
              >
                <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
                  {SETUP_SECTIONS.map((s) => {
                    const flagged =
                      (s.id === "profile" && profileIncomplete) ||
                      (s.id === "work" && hasNoWorkScenarios)
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-current={
                            effectiveSection === s.id ? "page" : undefined
                          }
                          onClick={() => setSetupSection(s.id)}
                          className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                            effectiveSection === s.id
                              ? "bg-independence-50 text-independence-800 dark:bg-gray-800 dark:text-independence-300"
                              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                          }`}
                        >
                          <i
                            aria-hidden="true"
                            className={`fas ${s.icon} w-4 text-center text-xs`}
                          />
                          <span className="flex-1">{s.label}</span>
                          {flagged && (
                            <span
                              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                                s.id === "profile"
                                  ? "bg-red-500"
                                  : "bg-amber-400"
                              }`}
                              aria-label="Needs your attention"
                            />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <div className="min-w-0 flex-1">
                {SETUP_SECTIONS.filter((s) => s.id === effectiveSection).map(
                  (s) => (
                    <div key={s.id} className="mb-4">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {s.label}
                      </h2>
                      <p className="mt-0.5 max-w-prose text-sm text-gray-600 dark:text-gray-400">
                        {s.hint}
                      </p>
                    </div>
                  ),
                )}

                {/* About you is facts about the person. The plan's display
                    currency and work scenario used to sit here too; both now
                    live with the thing they configure. */}
                {effectiveSection === "profile" && (
                  <IndependenceSettingsPanel />
                )}

                {effectiveSection === "work" && (
                  <CompositeTab
                    plans={phaseTabPlans}
                    settings={settings}
                    activePlanId={activePlanId}
                    mode="work"
                  />
                )}

                {/* Journey-level assumptions. Rendered through CompositeTab
                    like the other editors: it reads the projection echo for
                    per-stage provenance, which only exists inside the
                    composite provider. */}
                {effectiveSection === "assumptions" && (
                  <CompositeTab
                    plans={phaseTabPlans}
                    settings={settings}
                    activePlanId={activePlanId}
                    mode="assumptions"
                  />
                )}

                {effectiveSection === "wealth" && activeJourneyPhased && (
                  <CompositeTab
                    plans={phaseTabPlans}
                    settings={settings}
                    activePlanId={activePlanId}
                    mode="wealth"
                  />
                )}

                {effectiveSection === "stages" && (
                  <div className="space-y-6">
                    {generatePhasesError && (
                      <Alert>
                        <div className="flex items-center justify-between">
                          <span>{generatePhasesError}</span>
                          <button
                            onClick={() => setGeneratePhasesError(null)}
                            className="ml-2 text-red-500 hover:text-red-700"
                            aria-label="Dismiss"
                          >
                            <i aria-hidden="true" className="fas fa-times" />
                          </button>
                        </div>
                      </Alert>
                    )}

                    {/* Offer phasing while the plan being viewed has no
                        composite of its own. A second plan is phased on its own
                        terms — the user's other plans, and their phase counts,
                        say nothing about this one. */}
                    {!isLoading && !journeysLoading && planToPhase && (
                      <GeneratePhasesOffer
                        plan={planToPhase}
                        onGenerate={handleGeneratePhases}
                        isLoading={isGeneratingPhases}
                      />
                    )}

                    {/* The timeline and the stage list were two separate tabs
                        both called "Phases", one level apart. They are one
                        thing: the shape of the plan, and the stages it's made
                        of. */}
                    {activeJourneyPhased && (
                      <CompositeTab
                        plans={phaseTabPlans}
                        settings={settings}
                        activePlanId={activePlanId}
                        mode="stages"
                      />
                    )}

                    {!isLoading && !error && phaseTabPlans.length === 0 && (
                      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-independence-100">
                          <i
                            aria-hidden="true"
                            className="fas fa-umbrella-beach text-3xl text-independence-600"
                          />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold text-gray-900">
                          Nothing mapped out yet
                        </h3>
                        <p className="mx-auto mb-6 max-w-md text-gray-600">
                          Answer a few questions and we&apos;ll build your first
                          stage, then show you where the money takes you.
                        </p>
                        <div className="flex flex-col justify-center gap-3 sm:flex-row">
                          <Link
                            href="/independence/setup"
                            className="inline-flex items-center rounded-lg bg-independence-600 px-6 py-3 font-medium text-white hover:bg-independence-700"
                          >
                            <i
                              aria-hidden="true"
                              className="fas fa-magic mr-2"
                            />
                            Get started
                          </Link>
                          <Link
                            href={addStageHref(activePlanId)}
                            className="inline-flex items-center rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <i
                              aria-hidden="true"
                              className="fas fa-sliders-h mr-2"
                            />
                            Set it up myself
                          </Link>
                        </div>
                      </div>
                    )}

                    {!isLoading && phaseTabPlans.length > 0 && (
                      <div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                            Your stages
                          </h3>
                          <Link
                            href={addStageHref(activePlanId)}
                            className="inline-flex items-center rounded-lg bg-independence-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-independence-700 motion-reduce:transition-none"
                          >
                            <i
                              aria-hidden="true"
                              className="fas fa-plus mr-2"
                            />
                            Add a stage
                          </Link>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                          {phaseTabPlans.map((plan: RetirementPlan) => (
                            <PlanCard
                              key={plan.id}
                              plan={plan}
                              assets={assets}
                              hideValues={hideValues}
                              onDelete={setDeletePlanId}
                              onExport={handleExportPlan}
                              onCopy={handleCopyClick}
                              onSetPrimary={handleSetPrimary}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!isLoading && effectiveView === "shared" && (
            <>
              {leaveError && (
                <Alert variant="error" className="mb-4">
                  {leaveError}
                </Alert>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sharedPlans.map((plan: RetirementPlan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    assets={assets}
                    hideValues={hideValues}
                    onDelete={setDeletePlanId}
                    onExport={handleExportPlan}
                    onCopy={handleCopyClick}
                    onSetPrimary={handleSetPrimary}
                    isSharedPlan
                    onLeaveShare={(planId) => {
                      setLeaveError(null)
                      setLeavePlanId(planId)
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {!isLoading && activeJourneyPhased && effectiveView === "plan" && (
            // Journey-scoped, not every owned row: `plans` flows through
            // useCompositeProjection into context and on to PhaseConfigList,
            // which offers each entry as a timeline candidate and distributes
            // ages across all of them. Passing every owned row put the *other*
            // journey's phases on this journey's plan, one click from being
            // seeded and saved into this journey's composite.
            <CompositeTab
              plans={phaseTabPlans}
              settings={settings}
              activePlanId={activePlanId}
              mode="plan"
            />
          )}
        </div>
      </div>

      {showShareDialog && plans.length > 0 && (
        <ResourceShareInviteDialog
          resourceType="INDEPENDENCE_PLAN"
          resources={plans.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setShowShareDialog(false)}
          onSuccess={() => setShowShareDialog(false)}
        />
      )}
      {deletePlanId && (
        <ConfirmDialog
          title="Delete Phase"
          message="Are you sure you want to delete this phase?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="red"
          onConfirm={handleDeletePlanConfirm}
          onCancel={() => setDeletePlanId(null)}
        />
      )}
      {leavePlanId && (
        <ConfirmDialog
          title="Leave shared plan"
          message="You will no longer see this plan or any data the owner shared with it. The owner keeps the plan and any other portfolio shares stay as-is."
          confirmLabel="Leave"
          cancelLabel="Cancel"
          variant="red"
          onConfirm={() => handleLeaveSharedPlan(leavePlanId)}
          onCancel={() => {
            setLeavePlanId(null)
            setLeaveError(null)
          }}
        />
      )}
      {copyPlan && (
        <Dialog
          title="Copy Phase"
          onClose={() => setCopyPlan(null)}
          maxWidth="sm"
          footer={
            <>
              <Dialog.CancelButton onClick={() => setCopyPlan(null)} />
              <Dialog.SubmitButton
                onClick={handleCopyConfirm}
                label="Copy"
                variant="blue"
                disabled={!copyName.trim()}
              />
            </>
          }
        >
          <p className="text-gray-600 text-sm mb-3">
            Create a copy of &ldquo;{copyPlan.name}&rdquo; with all expenses and
            contributions.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New phase name
          </label>
          <input
            type="text"
            value={copyName}
            onChange={(e) => setCopyName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && copyName.trim()) handleCopyConfirm()
            }}
          />
        </Dialog>
      )}
    </>
  )
}

export default withPageAuthRequired(RetirementPlanning)
