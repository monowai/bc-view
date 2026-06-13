import React, { useState, useEffect } from "react"
import { useRouter } from "next/router"
import Head from "next/head"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import IndependencePlanStep from "@components/features/onboarding/steps/IndependencePlanStep"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { WorkScenario } from "types/independence"

const currentYear = new Date().getFullYear()

function IndependenceSetupPage(): React.ReactElement {
  const router = useRouter()
  const { preferences } = useUserPreferences()

  const [yearOfBirth, setYearOfBirth] = useState(currentYear - 35)
  const [monthOfBirth, setMonthOfBirth] = useState(1)
  const [targetRetirementAge, setTargetRetirementAge] = useState(65)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
  const [workingIncomeMonthly, setWorkingIncomeMonthly] = useState(0)
  const [workingExpensesMonthly, setWorkingExpensesMonthly] = useState(0)
  const [taxesMonthly, setTaxesMonthly] = useState(0)
  const [bonusMonthly, setBonusMonthly] = useState(0)
  const [investmentAllocationPercent, setInvestmentAllocationPercent] =
    useState(80)
  const [existingScenarioId, setExistingScenarioId] = useState<string | null>(
    null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized || !preferences) return

    // Pre-fill DOB from user preferences
    if (preferences.yearOfBirth) setYearOfBirth(preferences.yearOfBirth)
    if (preferences.monthOfBirth) setMonthOfBirth(preferences.monthOfBirth)

    // Fetch existing work scenarios — pre-fill from current one if present
    fetch("/api/independence/work-scenarios")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { data?: WorkScenario[] } | null) => {
        const scenarios: WorkScenario[] = data?.data ?? []
        const current =
          scenarios.find((s) => s.isCurrent) ?? scenarios[0] ?? null
        if (current) {
          setExistingScenarioId(current.id)
          setWorkingIncomeMonthly(current.workingIncomeMonthly ?? 0)
          setWorkingExpensesMonthly(current.workingExpensesMonthly ?? 0)
          setTaxesMonthly(current.taxesMonthly ?? 0)
          setBonusMonthly(current.bonusMonthly ?? 0)
          // API stores allocation as decimal fraction; form uses 0-100
          setInvestmentAllocationPercent(
            (current.investmentAllocationPercent ?? 0.8) * 100,
          )
        }
      })
      .catch(() => undefined)

    setInitialized(true)
  }, [preferences, initialized])

  const baseCurrency = preferences?.baseCurrencyCode ?? "USD"

  const handleSubmit = async (): Promise<void> => {
    setIsSubmitting(true)
    setError(null)
    try {
      // Persist profile to user preferences
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearOfBirth, monthOfBirth }),
      })

      const workPayload = {
        name: "My Work Scenario",
        currency: baseCurrency,
        workingIncomeMonthly,
        workingExpensesMonthly,
        taxesMonthly,
        bonusMonthly,
        investmentAllocationPercent: investmentAllocationPercent / 100,
      }

      if (existingScenarioId) {
        // Update the existing scenario rather than creating a duplicate
        await fetch(`/api/independence/work-scenarios/${existingScenarioId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workPayload),
        })
      } else {
        await fetch("/api/independence/work-scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workPayload),
        })
      }

      // Create the independence plan
      const planResponse = await fetch("/api/independence/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Independence Plan",
          yearOfBirth,
          planningHorizonYears: 90 - targetRetirementAge,
          lifeExpectancy: 90,
          monthlyExpenses,
          expensesCurrency: baseCurrency,
          cashReturnRate: 0.03,
          equityReturnRate: 0.08,
          housingReturnRate: 0.04,
          inflationRate: 0.025,
          cashAllocation: 0.2,
          equityAllocation: 0.8,
          housingAllocation: 0.0,
          pensionMonthly: 0,
          socialSecurityMonthly: 0,
          otherIncomeMonthly: 0,
          workingIncomeMonthly,
          workingExpensesMonthly,
          taxesMonthly,
          bonusMonthly,
          investmentAllocationPercent: investmentAllocationPercent / 100,
        }),
      })

      if (!planResponse.ok) {
        throw new Error("Failed to create independence plan")
      }

      const plan = await planResponse.json()
      const planId = plan?.data?.id ?? plan?.id
      if (planId) {
        await router.push(`/independence/wizard/${planId}`)
      } else {
        await router.push("/independence")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>{"Set Up Your Independence Plan"}</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-independence-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-umbrella-beach text-2xl text-independence-600"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {"Set Up Your Independence Plan"}
            </h1>
            <p className="text-gray-600">
              {
                "Answer a few questions to start projecting your financial freedom timeline."
              }
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
            <IndependencePlanStep
              enabled={true}
              hideToggle={true}
              yearOfBirth={yearOfBirth}
              monthOfBirth={monthOfBirth}
              monthlyExpenses={monthlyExpenses}
              targetRetirementAge={targetRetirementAge}
              workingIncomeMonthly={workingIncomeMonthly}
              workingExpensesMonthly={workingExpensesMonthly}
              taxesMonthly={taxesMonthly}
              bonusMonthly={bonusMonthly}
              investmentAllocationPercent={investmentAllocationPercent}
              onEnabledChange={() => undefined}
              onYearOfBirthChange={setYearOfBirth}
              onMonthOfBirthChange={setMonthOfBirth}
              onMonthlyExpensesChange={setMonthlyExpenses}
              onTargetRetirementAgeChange={setTargetRetirementAge}
              onWorkingIncomeMonthlyChange={setWorkingIncomeMonthly}
              onWorkingExpensesMonthlyChange={setWorkingExpensesMonthly}
              onTaxesMonthlyChange={setTaxesMonthly}
              onBonusMonthlyChange={setBonusMonthly}
              onInvestmentAllocationPercentChange={
                setInvestmentAllocationPercent
              }
              baseCurrency={baseCurrency}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/independence")}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                {"Skip for now"}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-independence-600 text-white rounded-lg hover:bg-independence-700 font-medium disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Create My Plan"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(IndependenceSetupPage)
