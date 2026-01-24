import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import React, { useEffect, useState } from "react"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Portfolio } from "types/beancounter"
import { useRegistration } from "@contexts/RegistrationContext"

const capitalize = (str: string): string =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : ""

export default withPageAuthRequired(function Home(): React.ReactElement {
  const { user, error, isLoading } = useUser()
  const { t } = useTranslation("common")
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
              {t("home.welcome")}{" "}
              <span className="text-gray-700">{displayName}</span>
            </h1>
            <p className="text-gray-500 text-lg">
              Start anywhere. Everything connects.
            </p>
          </div>
        </div>

        {/* Getting Started - shown when user has no portfolios */}
        {portfoliosData?.data?.length === 0 && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
                {t("home.getStarted", "Let's Get You Started")}
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                {t("portfolios.empty.title", "No portfolios yet")}
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
                    {t("home.startSetup", "Start Setup")}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {t(
                      "portfolios.guided",
                      "Guided setup for bank accounts, property, and pensions",
                    )}
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
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {t("portfolio.create")}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {t(
                      "portfolios.direct",
                      "Create a portfolio directly with full control",
                    )}
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
              className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-500 to-blue-700 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
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

          {/* Tagline */}
          <p className="text-center text-gray-500 mt-8">
            Confidence comes from connecting assets, goals, and strategy.
          </p>
        </div>
      </div>
    )
  }
  return <Link href={"/api/auth/login"}>{t("user.login")}</Link>
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
