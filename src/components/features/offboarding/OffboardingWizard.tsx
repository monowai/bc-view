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
        const plansData = await plansRes.json()
        setPlanCount(plansData.data?.length ?? 0)
      }

      if (modelsRes?.ok) {
        const modelsData = await modelsRes.json()
        setModelCount(modelsData.data?.length ?? 0)
      }
    } catch (error) {
      console.error("Failed to fetch offboarding summary:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
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
        }
      }

      if (deletePlans && !deleteAccount) {
        const response = await fetch("/api/offboard/plans", {
          method: "DELETE",
        })
        if (response.ok) {
          const result = await response.json()
          newResults.push(result)
        }
      }

      if (deleteModels && !deleteAccount) {
        const response = await fetch("/api/offboard/models", {
          method: "DELETE",
        })
        if (response.ok) {
          const result = await response.json()
          newResults.push(result)
        }
      }

      if (deleteAccount) {
        // Delete from all services when deleting account
        const [wealthRes, plansRes, modelsRes, accountRes] = await Promise.all([
          fetch("/api/offboard/wealth", { method: "DELETE" }),
          fetch("/api/offboard/plans", { method: "DELETE" }).catch(() => null),
          fetch("/api/offboard/models", { method: "DELETE" }).catch(() => null),
          fetch("/api/offboard/account", { method: "DELETE" }),
        ])

        if (wealthRes.ok) {
          newResults.push(await wealthRes.json())
        }
        if (plansRes?.ok) {
          newResults.push(await plansRes.json())
        }
        if (modelsRes?.ok) {
          newResults.push(await modelsRes.json())
        }
        if (accountRes.ok) {
          newResults.push(await accountRes.json())
        }
      }

      setResults(newResults)
      setCurrentStep(5) // Move to complete step
    } catch (error) {
      console.error("Deletion failed:", error)
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
      case 5:
        return <CompleteStep results={results} accountDeleted={deleteAccount} />
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
