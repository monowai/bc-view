import React, { useMemo, useRef, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
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
import { sortPlansByCompositeOrder } from "@lib/independence/planOrdering"
import {
  useAssetBreakdown,
  useFiProjectionSimple,
  AssetBreakdown,
} from "@components/features/independence"
import CompositeTab from "@components/features/independence/CompositeTab"
import GeneratePhasesOffer from "@components/features/independence/GeneratePhasesOffer"
import ScenarioList from "@components/features/independence/scenarios/ScenarioList"
import IndependenceSettingsPanel from "@components/features/independence/IndependenceSettingsPanel"
import ResourceShareInviteDialog from "@components/features/shares/ResourceShareInviteDialog"
import PendingResourceSharesPanel from "@components/features/shares/PendingResourceSharesPanel"
import Alert from "@components/ui/Alert"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"

const plansKey = "/api/independence/plans"
const HIDDEN_VALUE = "****"

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
  const netMonthlyExpenses = Math.max(
    0,
    plan.monthlyExpenses - totalMonthlyIncome,
  )

  // Use server-calculated FI Number if available, otherwise fall back to local calculation
  // FI Number = 25× net annual expenses (based on 4% SWR)
  const fiNumber =
    projection?.fiMetrics?.fiNumber ?? Math.round(netMonthlyExpenses * 12 * 25)
  const fiProgress = projection?.fiMetrics?.fiProgress ?? 0

  const getProgressColor = (progress: number): string => {
    if (progress >= 100) return "text-green-600"
    if (progress >= 75) return "text-blue-600"
    if (progress >= 50) return "text-yellow-600"
    return "text-independence-600"
  }

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
                href={`/independence/wizard/${plan.id}`}
                className="!text-green-600 hover:!text-green-900 p-1.5"
                title="Edit plan"
              >
                <i className="fas fa-edit"></i>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* FI Number and Progress */}
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
                FI Number
              </span>
              <span
                className={`font-bold tabular-nums ${hideValues ? "text-gray-400" : "text-independence-600"}`}
              >
                {hideValues
                  ? HIDDEN_VALUE
                  : `${currency}${Math.round(fiNumber).toLocaleString()}`}
              </span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">FI Progress</span>
                <span
                  className={`text-xs font-medium tabular-nums ${hideValues ? "text-gray-400" : getProgressColor(fiProgress)}`}
                >
                  {hideValues ? HIDDEN_VALUE : `${fiProgress.toFixed(1)}%`}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBgColor(fiProgress)} transition-all duration-500`}
                  style={{
                    width: hideValues ? "0%" : `${Math.min(fiProgress, 100)}%`,
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              <i className="fas fa-bullseye text-independence-500 mr-1"></i>
              FI Number
            </span>
            <span className="text-xs text-gray-500">
              25× annual expenses (4% SWR)
            </span>
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
        View Plan
      </Link>
    </div>
  )
}

function RetirementPlanning(): React.ReactElement {
  const router = useRouter()
  const { hideValues } = usePrivacyMode()
  const { settings, mutateSettings } = useIndependenceSettings()
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
  // Allow deep-linking to a view, e.g. `/independence?view=profile` from the
  // "set your date of birth" notice on the plan page.
  // Legacy `?view=plans` links map to the renamed `phases` view.
  const requestedView =
    router.query.view === "plans" ? "phases" : router.query.view
  const initialView =
    requestedView === "profile" ||
    requestedView === "work" ||
    requestedView === "phases" ||
    requestedView === "shared" ||
    requestedView === "composite"
      ? requestedView
      : "phases"
  const [activeView, setActiveView] = useState<
    "profile" | "work" | "phases" | "shared" | "composite"
  >(initialView)
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
    if (ownedPlans.length !== 1) return
    const planId = ownedPlans[0].id
    setIsGeneratingPhases(true)
    setGeneratePhasesError(null)
    try {
      const response = await fetch(`/api/independence/plans/${planId}/phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // force: with a single owned plan, any existing composite is necessarily
        // stale (a real phased composite references three plans), so overwrite it
        // rather than letting the backend reject with "composite already exists".
        body: JSON.stringify({ force: true }),
      })
      if (!response.ok) {
        const body = await response.text()
        setGeneratePhasesError(
          body || `Failed to generate phases (${response.status})`,
        )
        return
      }
      await Promise.all([mutate(), mutateSettings()])
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
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Independence Planning
              </h1>
              <p className="text-gray-600">
                Plan your financial future with projections and scenarios.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".json"
                className="hidden"
              />
              {plans.length > 0 && (
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="hidden sm:flex border border-blue-300 text-blue-700 px-4 py-3 rounded-lg hover:bg-blue-50 font-medium items-center"
                >
                  <i className="fas fa-share-alt mr-2"></i>
                  Share
                </button>
              )}
              <button
                onClick={handleImportClick}
                disabled={isImporting}
                className="hidden sm:flex border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 font-medium items-center disabled:opacity-50"
              >
                {isImporting ? (
                  <Spinner label="Importing..." />
                ) : (
                  <>
                    <i className="fas fa-upload mr-2"></i>
                    Import
                  </>
                )}
              </button>
              {process.env.NODE_ENV === "development" && (
                <Link
                  href="/independence/debug"
                  className="hidden sm:flex border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 font-medium items-center"
                  title="Cross-check svc-retire metrics against local formulas"
                >
                  <i className="fas fa-bug mr-2"></i>
                  Debug
                </Link>
              )}
              <Link
                href="/independence/wizard"
                className="bg-independence-600 text-white px-6 py-3 rounded-lg hover:bg-independence-700 font-medium flex items-center"
              >
                <i className="fas fa-plus mr-2"></i>
                Create Phase
              </Link>
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

          {/* Tab Switcher */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveView("profile")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "profile"
                  ? profileIncomplete
                    ? "bg-white text-red-600 shadow-sm"
                    : "bg-white text-independence-700 shadow-sm"
                  : profileIncomplete
                    ? "text-red-600 hover:text-red-700"
                    : "text-gray-600 hover:text-gray-800"
              }`}
              title={
                profileIncomplete
                  ? "Set your date of birth, target age and life expectancy for accurate projections"
                  : "Profile settings"
              }
            >
              <i
                className={`fas ${profileIncomplete ? "fa-triangle-exclamation" : "fa-cog"} mr-2`}
              ></i>
              Profile
              {profileIncomplete && (
                <span
                  className="ml-1.5 inline-block w-2 h-2 rounded-full bg-red-500"
                  aria-label="Profile incomplete"
                />
              )}
            </button>
            <button
              onClick={() => setActiveView("work")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "work"
                  ? "bg-white text-independence-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              title={
                hasNoWorkScenarios
                  ? "Add a work scenario — your pre-independence income, salary and expenses"
                  : "Work scenarios — pre-independence income, salary and expenses"
              }
            >
              <i className="fas fa-briefcase mr-2"></i>
              Work
              {hasNoWorkScenarios && (
                <span
                  className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-400"
                  aria-label="No work scenario configured"
                />
              )}
            </button>
            <button
              onClick={() => setActiveView("phases")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "phases"
                  ? "bg-white text-independence-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <i className="fas fa-th-large mr-2"></i>
              Phases
            </button>
            {sharedPlans.length > 0 && (
              <button
                onClick={() => setActiveView("shared")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === "shared"
                    ? "bg-white text-independence-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <i className="fas fa-share-alt mr-2"></i>
                Shared
                <span className="ml-1.5 text-xs text-gray-500">
                  ({sharedPlans.length})
                </span>
              </button>
            )}
            {plans.length > 1 && (
              <button
                onClick={() => setActiveView("composite")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === "composite"
                    ? "bg-white text-independence-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <i className="fas fa-layer-group mr-2"></i>
                Composite
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

          {!isLoading &&
            !error &&
            plans.length === 0 &&
            activeView === "phases" && (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <div className="w-20 h-20 bg-independence-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-umbrella-beach text-3xl text-independence-600"></i>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  No independence plans yet
                </h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Answer a few quick questions to create your first independence
                  plan and start projecting your financial freedom timeline.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/independence/setup"
                    className="inline-flex items-center bg-independence-600 text-white px-6 py-3 rounded-lg hover:bg-independence-700 font-medium"
                  >
                    <i className="fas fa-magic mr-2"></i>
                    Get Started
                  </Link>
                  <Link
                    href="/independence/wizard"
                    className="inline-flex items-center border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    <i className="fas fa-sliders-h mr-2"></i>
                    Advanced Setup
                  </Link>
                </div>
              </div>
            )}

          {activeView === "profile" && <IndependenceSettingsPanel />}

          {generatePhasesError && activeView === "phases" && (
            <div className="mb-6">
              <Alert>
                <div className="flex justify-between items-center">
                  <span>{generatePhasesError}</span>
                  <button
                    onClick={() => setGeneratePhasesError(null)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </Alert>
            </div>
          )}

          {/* Offer phasing to any single-plan user. With one owned plan there is
              no valid phased composite yet, so the offer stays available even if
              a stale composite lingers; clicking it converts the plan to Go-Go. */}
          {!isLoading && ownedPlans.length === 1 && activeView === "phases" && (
            <div className="mb-6">
              <GeneratePhasesOffer
                plan={ownedPlans[0]}
                onGenerate={handleGeneratePhases}
                isLoading={isGeneratingPhases}
              />
            </div>
          )}

          {!isLoading && plans.length > 0 && activeView === "phases" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan: RetirementPlan) => (
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
          )}

          {!isLoading && activeView === "shared" && (
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

          {activeView === "work" && (
            <ScenarioList
              defaultCurrency={
                (plans.find((p) => p.isPrimary) ?? plans[0])?.expensesCurrency
              }
            />
          )}

          {!isLoading && plans.length > 1 && activeView === "composite" && (
            <CompositeTab plans={plans} settings={settings} />
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
          title="Delete Plan"
          message="Are you sure you want to delete this plan?"
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
          title="Copy Plan"
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
            New plan name
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
