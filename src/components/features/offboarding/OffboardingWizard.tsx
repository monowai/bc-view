import React, { useState, useEffect, useCallback } from "react"
import { OffboardingSummary, OffboardingResult } from "types/beancounter"
import OffboardingProgress from "./OffboardingProgress"
import SummaryStep from "./steps/SummaryStep"
import WealthStep from "./steps/WealthStep"
import PlanningStep from "./steps/PlanningStep"
import ConfirmAccountStep from "./steps/ConfirmAccountStep"
import CompleteStep from "./steps/CompleteStep"

export default function OffboardingWizard(): React.ReactElement {
  const [currentStep, setCurrentStep] = useState(1)
  const [summary, setSummary] = useState<OffboardingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [results, setResults] = useState<OffboardingResult[]>([])

  // Additional counts from other services
  const [planCount, setPlanCount] = useState(0)
  const [modelCount, setModelCount] = useState(0)

  // Deletion selections
  const [deleteWealth, setDeleteWealth] = useState(false)
  const [deletePlans, setDeletePlans] = useState(false)
  const [deleteModels, setDeleteModels] = useState(false)
  const [deleteAccount, setDeleteAccount] = useState(false)

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch data counts from all services in parallel
      const [summaryRes, plansRes, modelsRes] = await Promise.all([
        fetch("/api/offboard/summary"),
        fetch("/api/independence/plans").catch(() => null),
        fetch("/api/rebalance/models").catch(() => null),
      ])

      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setSummary(data)
      }

      if (plansRes?.ok) {
        // /api/independence/plans returns plans the caller can SEE,
        // which includes shared plans they don't own. The offboarding
        // delete only removes plans the caller owns, so the count
        // displayed has to exclude `sharedPlanIds`.
        const plansData = (await plansRes.json()) as {
          data?: Array<{ id: string }>
          sharedPlanIds?: string[]
        }
        const shared = new Set(plansData.sharedPlanIds ?? [])
        const owned = (plansData.data ?? []).filter((p) => !shared.has(p.id))
        setPlanCount(owned.length)
      }

      if (modelsRes?.ok) {
        // ModelDto exposes `isOwner` directly. Shared models (where
        // the caller is a viewer, not the owner) are excluded so the
        // count matches what offboarding will actually delete.
        const modelsData = (await modelsRes.json()) as {
          data?: Array<{ isOwner?: boolean }>
        }
        const owned = (modelsData.data ?? []).filter((m) => m.isOwner !== false)
        setModelCount(owned.length)
      }
    } catch (error) {
      console.error("Failed to fetch offboarding summary:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Legitimate external sync: fetch offboarding summary counts from the
    // services on mount. fetchSummary flips `loading` synchronously, which the
    // rule flags, but there is no derived-state refactor here — it is a
    // genuine data fetch, so the effect is the correct place for it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary()
  }, [fetchSummary])

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true)
    const newResults: OffboardingResult[] = []

    try {
      // Delete in order: wealth, plans, models, account
      if (deleteWealth && !deleteAccount) {
        const response = await fetch("/api/offboard/wealth", {
          method: "DELETE",
        })
        if (response.ok) {
          const result = await response.json()
          newResults.push(result)
        } else {
          newResults.push({
            success: false,
            deletedCount: 0,
            type: "wealth",
            message: `Delete failed (${response.status})`,
          })
        }
      }

      if (deletePlans && !deleteAccount) {
        const response = await fetch("/api/offboard/plans", {
          method: "DELETE",
        })
        if (response.ok) {
          const result = await response.json()
          newResults.push(result)
        } else {
          newResults.push({
            success: false,
            deletedCount: 0,
            type: "plans",
            message: `Delete failed (${response.status})`,
          })
        }
      }

      if (deleteModels && !deleteAccount) {
        const response = await fetch("/api/offboard/models", {
          method: "DELETE",
        })
        if (response.ok) {
          const result = await response.json()
          newResults.push(result)
        } else {
          newResults.push({
            success: false,
            deletedCount: 0,
            type: "models",
            message: `Delete failed (${response.status})`,
          })
        }
      }

      if (deleteAccount) {
        // Bug A fix: /api/offboard/account already deletes portfolios + assets +
        // brokers + tax rates + the user (it is the superset). Do NOT call
        // /api/offboard/wealth here — that would race against account on the
        // same rows and cause an optimistic-lock collision.
        const [plansRes, modelsRes, accountRes] = await Promise.all([
          fetch("/api/offboard/plans", { method: "DELETE" }).catch(() => null),
          fetch("/api/offboard/models", { method: "DELETE" }).catch(() => null),
          fetch("/api/offboard/account", { method: "DELETE" }),
        ])

        if (plansRes?.ok) {
          newResults.push(await plansRes.json())
        } else if (plansRes != null) {
          newResults.push({
            success: false,
            deletedCount: 0,
            type: "plans",
            message: `Delete failed (${plansRes.status})`,
          })
        }
        if (modelsRes?.ok) {
          newResults.push(await modelsRes.json())
        } else if (modelsRes != null) {
          newResults.push({
            success: false,
            deletedCount: 0,
            type: "models",
            message: `Delete failed (${modelsRes.status})`,
          })
        }
        if (accountRes.ok) {
          newResults.push(await accountRes.json())
        } else {
          newResults.push({
            success: false,
            deletedCount: 0,
            type: "account",
            message: `Delete failed (${accountRes.status})`,
          })
        }
      }

      setResults(newResults)
      setCurrentStep(5) // Move to complete step
    } catch (error) {
      console.error("Deletion failed:", error)
      newResults.push({
        success: false,
        deletedCount: 0,
        type: "unknown",
        message: "An unexpected error occurred",
      })
      setResults(newResults)
      setCurrentStep(5)
    } finally {
      setIsDeleting(false)
    }
  }

  const hasSelections = deleteWealth || deletePlans || deleteModels

  const renderStep = (): React.ReactElement => {
    switch (currentStep) {
      case 1:
        return (
          <SummaryStep
            summary={summary}
            planCount={planCount}
            modelCount={modelCount}
            loading={loading}
            onNext={() => setCurrentStep(2)}
          />
        )
      case 2:
        return (
          <WealthStep
            summary={summary}
            deleteWealth={deleteWealth}
            setDeleteWealth={setDeleteWealth}
            onBack={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
          />
        )
      case 3:
        return (
          <PlanningStep
            planCount={planCount}
            modelCount={modelCount}
            deletePlans={deletePlans}
            setDeletePlans={setDeletePlans}
            deleteModels={deleteModels}
            setDeleteModels={setDeleteModels}
            onBack={() => setCurrentStep(2)}
            onNext={() => setCurrentStep(4)}
          />
        )
      case 4:
        return (
          <ConfirmAccountStep
            deleteAccount={deleteAccount}
            setDeleteAccount={setDeleteAccount}
            onBack={() => setCurrentStep(3)}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            hasSelections={hasSelections}
          />
        )
      case 5: {
        // Bug B fix: accountDeleted must be true only when the account DELETE
        // actually succeeded, not merely when the user requested it.
        const accountSucceeded = results.some(
          (r) => r.type === "account" && r.success,
        )
        return (
          <CompleteStep results={results} accountDeleted={accountSucceeded} />
        )
      }
      default:
        return <div>Unknown step</div>
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {currentStep < 5 && <OffboardingProgress currentStep={currentStep} />}
      {renderStep()}
    </div>
  )
}
