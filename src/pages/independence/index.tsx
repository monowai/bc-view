import React, { useRef, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import useSwr from "swr"
import { simpleFetcher, holdingKey } from "@utils/api/fetchHelper"
import { PlansResponse, RetirementPlan, PlanExport } from "types/independence"
import { HoldingContract } from "types/beancounter"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import {
  useAssetBreakdown,
  useFiProjectionSimple,
  AssetBreakdown,
} from "@components/features/independence"
import ResourceShareInviteDialog from "@components/features/shares/ResourceShareInviteDialog"
import Alert from "@components/ui/Alert"
import ConfirmDialog from "@components/ui/ConfirmDialog"
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
}: {
  plan: RetirementPlan
  assets: AssetBreakdown
  hideValues: boolean
  onDelete: (planId: string) => void
  onExport: (plan: RetirementPlan) => void
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
          <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
          <p className="text-sm text-gray-500">
            {plan.planningHorizonYears} year horizon
            {plan.expensesCurrency && ` · ${plan.expensesCurrency}`}
          </p>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onDelete(plan.id)}
            className="text-red-600 hover:text-red-900 p-1.5 mr-1"
            title="Delete plan"
          >
            <i className="fas fa-trash text-xs"></i>
          </button>
          <button
            onClick={() => onExport(plan)}
            className="text-gray-400 hover:text-gray-600 p-1.5"
            title="Export plan as JSON"
          >
            <i className="fas fa-download text-xs"></i>
          </button>
          <Link
            href={`/independence/wizard/${plan.id}`}
            className="!text-green-600 hover:!text-green-900 p-1.5"
            title="Edit plan"
          >
            <i className="fas fa-edit"></i>
          </Link>
        </div>
      </div>

      {/* FI Number and Progress */}
      <div className="bg-gradient-to-r from-independence-50 to-independence-100 rounded-lg p-3 mb-4 border border-independence-100">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            <i className="fas fa-bullseye text-independence-500 mr-1"></i>
            FI Number
          </span>
          <span
            className={`font-bold ${hideValues ? "text-gray-400" : "text-independence-600"}`}
          >
            {hideValues
              ? HIDDEN_VALUE
              : `${currency}${Math.round(fiNumber).toLocaleString()}`}
          </span>
        </div>

        {/* FI Progress Bar */}
        {fiLoading ? (
          <div className="mt-2 flex items-center text-xs text-gray-400">
            <Spinner label="Calculating progress..." />
          </div>
        ) : projection?.fiMetrics ? (
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500">FI Progress</span>
              <span
                className={`text-xs font-medium ${hideValues ? "text-gray-400" : getProgressColor(fiProgress)}`}
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
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            25× annual expenses (4% SWR)
          </p>
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
                : `-${currency}${Math.round(totalMonthlyIncome).toLocaleString()}`}
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
        className="w-full block text-center bg-independence-50 text-independence-600 px-4 py-2 rounded-lg hover:bg-independence-100 font-medium"
      >
        View Projections
      </Link>
    </div>
  )
}

function RetirementPlanning(): React.ReactElement {
  const router = useRouter()
  const { hideValues } = usePrivacyMode()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)

  const { data, error, isLoading, mutate } = useSwr<PlansResponse>(
    plansKey,
    simpleFetcher(plansKey),
  )

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

  const plans = data?.data || []

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
              <Link
                href="/independence/wizard"
                className="bg-independence-600 text-white px-6 py-3 rounded-lg hover:bg-independence-700 font-medium flex items-center"
              >
                <i className="fas fa-plus mr-2"></i>
                Create Plan
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

          {isLoading && (
            <div className="text-center py-12">
              <Spinner label="Loading plans..." size="lg" />
            </div>
          )}

          {error && <Alert>Failed to load plans. Please try again.</Alert>}

          {!isLoading && !error && plans.length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="w-20 h-20 bg-independence-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-umbrella-beach text-3xl text-independence-600"></i>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No independence plans yet
              </h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Create your first independence plan to start projecting your
                financial runway and exploring different scenarios.
              </p>
              <Link
                href="/independence/wizard"
                className="inline-flex items-center bg-independence-600 text-white px-6 py-3 rounded-lg hover:bg-independence-700 font-medium"
              >
                <i className="fas fa-plus mr-2"></i>
                Create Your First Plan
              </Link>
            </div>
          )}

          {!isLoading && plans.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan: RetirementPlan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  assets={assets}
                  hideValues={hideValues}
                  onDelete={setDeletePlanId}
                  onExport={handleExportPlan}
                />
              ))}
            </div>
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
    </>
  )
}

export default withPageAuthRequired(RetirementPlanning)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
})
