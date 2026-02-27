import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import React, { useEffect, useState } from "react"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { useMilestones } from "@contexts/MilestonesContext"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Portfolio } from "types/beancounter"
import { useRegistration } from "@contexts/RegistrationContext"
import MilestoneBadge from "@components/features/milestones/MilestoneBadge"
import { MilestoneTier } from "@utils/milestones/types"

const capitalize = (str: string): string =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : ""

function RecentMilestones(): React.ReactElement | null {
  const { milestones, mode } = useMilestones()
  if (mode === "OFF") return null
  const earned = milestones
    .filter((s) => s.earnedTier !== null)
    .sort(
      (a, b) =>
        (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "") ||
        (b.earnedTier ?? 0) - (a.earnedTier ?? 0),
    )
    .slice(0, 3)
  if (earned.length === 0) return null
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-600">
          Recent Milestones
        </h3>
        <Link
          href="/milestones"
          className="text-xs text-blue-500 hover:text-blue-700"
        >
          View all
        </Link>
      </div>
      <div className="flex gap-4 justify-center">
        {earned.map((s) => (
          <Link
            key={s.definition.id}
            href="/milestones"
            className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <MilestoneBadge
              definition={s.definition}
              tier={s.earnedTier as MilestoneTier}
            />
            <span className="text-xs text-gray-600 text-center max-w-[80px] truncate">
              {s.definition.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default withPageAuthRequired(function Home(): React.ReactElement {
  const { user, error, isLoading } = useUser()
  const { preferences, isLoading: prefsLoading } = useUserPreferences()
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)

  // Get registration state from context
  const { isChecking, isRegistered, isOnboardingComplete } = useRegistration()

  // Pre-fetch portfolios so they're cached for subsequent pages
  const { data: portfoliosData } = useSwr<{ data: Portfolio[] }>(
    // Only fetch portfolios once registered
    isRegistered ? portfoliosKey : null,
    simpleFetcher(portfoliosKey),
  )

  // Check if data is ready
  useEffect(() => {
    if (isLoading || isChecking || prefsLoading) return

    // If onboarding is complete (from context), show the home page
    if (isOnboardingComplete) {
      setCheckingOnboarding(false)
      return
    }

    // Wait for portfolios data to load before deciding
    if (!isRegistered || portfoliosData === undefined) {
      return // Still loading portfolios
    }

    // Data is loaded, show the page (with or without portfolios)
    setCheckingOnboarding(false)
  }, [
    isLoading,
    isChecking,
    prefsLoading,
    isRegistered,
    isOnboardingComplete,
    portfoliosData,
  ])

  const displayName = preferences?.preferredName
    ? preferences.preferredName
    : user?.nickname
      ? capitalize(user.nickname)
      : user?.name || ""

  if (isLoading || isChecking || checkingOnboarding)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        {error.message}
      </div>
    )

  if (user) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {"Welcome!"} <span className="text-gray-700">{displayName}</span>
            </h1>
            <p className="text-gray-500 text-lg">
              Connecting goals, strategy, and assets — making progress visible
            </p>
          </div>
        </div>

        {/* Getting Started - shown when user has no portfolios */}
        {portfoliosData?.data?.length === 0 && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
                {"Let's Get You Started"}
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                {"No portfolios yet"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Guided Setup - for novice users */}
                <Link
                  href="/onboarding"
                  className="border border-gray-200 rounded-xl p-5 text-center hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-rocket text-xl text-blue-500"></i>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {"Start Setup"}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {"Guided setup for bank accounts, property, and pensions"}
                  </p>
                </Link>
                {/* Direct Add - for professional users */}
                <Link
                  href="/portfolios/__NEW__"
                  className="border border-gray-200 rounded-xl p-5 text-center hover:border-green-300 hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-plus text-xl text-green-500"></i>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{"Add"}</h3>
                  <p className="text-gray-500 text-sm">
                    {"Create a portfolio directly with full control"}
                  </p>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Three Domains */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Wealth - Blue */}
            <Link
              href="/wealth"
              className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-500 to-blue-600 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5"></div>
              <div className="relative">
                <div className="mb-4">
                  <i className="fas fa-coins text-4xl text-white/90"></i>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Manage Wealth
                </h2>
                <p className="text-blue-100 text-sm mb-4">
                  What do I have? See net worth across brokers, assets and
                  currencies in one place.
                </p>
                <ul className="text-blue-100 text-xs space-y-1">
                  <li>
                    <i className="fas fa-check mr-2"></i>Multi-currency
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Multi-broker
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Multi-asset
                  </li>
                </ul>
                <div className="mt-4 flex items-center text-white font-medium">
                  View Net Worth
                  <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </Link>

            {/* Independence - Sunset */}
            <Link
              href="/independence"
              className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-orange-400 via-orange-500 to-rose-500 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5"></div>
              <div className="relative">
                <div className="mb-4">
                  <i className="fas fa-umbrella-beach text-4xl text-white/90"></i>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Plan Independence
                </h2>
                <p className="text-orange-100 text-sm mb-4">
                  What do I want? Plan your financial independence with
                  withdrawal strategies and identify when work becomes optional.
                </p>
                <ul className="text-orange-100 text-xs space-y-1">
                  <li>
                    <i className="fas fa-check mr-2"></i>Withdrawal strategies
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Inflation modeling
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>FIRE calculations
                  </li>
                </ul>
                <div className="mt-4 flex items-center text-white font-medium">
                  Independence Plans
                  <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </Link>

            {/* Invest - Green */}
            <Link
              href="/rebalance/models"
              className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-700 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5"></div>
              <div className="relative">
                <div className="mb-4">
                  <i className="fas fa-balance-scale text-4xl text-white/90"></i>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Investment Strategy
                </h2>
                <p className="text-emerald-100 text-sm mb-4">
                  How will I get there? Turn goals and assets into coherent,
                  rebalanceable investment strategies
                </p>
                <ul className="text-emerald-100 text-xs space-y-1">
                  <li>
                    <i className="fas fa-check mr-2"></i>Model portfolios
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Invest cash against
                    models
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Rebalance portfolios to
                    models
                  </li>
                </ul>
                <div className="mt-4 flex items-center text-white font-medium">
                  View Models
                  <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </Link>
          </div>

          {/* Recent Milestones */}
          <RecentMilestones />

          {/* Tagline */}
          <p className="text-center text-gray-500 mt-8">
            Start anywhere. Everything connects over time.
          </p>
        </div>
      </div>
    )
  }
  return <Link href={"/auth/login"}>{"Login"}</Link>
})
