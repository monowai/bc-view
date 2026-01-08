import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import React from "react"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Portfolio } from "types/beancounter"

const capitalize = (str: string): string =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : ""

export default withPageAuthRequired(function Home(): React.ReactElement {
  const { user, error, isLoading } = useUser()
  const { t } = useTranslation("common")
  const { preferences } = useUserPreferences()

  // Pre-fetch portfolios so they're cached for subsequent pages
  useSwr<{ data: Portfolio[] }>(portfoliosKey, simpleFetcher(portfoliosKey))

  const displayName = preferences?.preferredName
    ? preferences.preferredName
    : user?.nickname
      ? capitalize(user.nickname)
      : user?.name || ""

  if (isLoading)
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
              Track, invest, and plan your financial future
            </p>
          </div>
        </div>

        {/* Three Domains */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Wealth - Blue */}
            <Link
              href="/wealth"
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5"></div>
              <div className="relative">
                <div className="mb-4">
                  <i className="fas fa-coins text-4xl text-white/90"></i>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Wealth</h2>
                <p className="text-blue-100 text-sm mb-4">
                  Track your complete net worth across all assets, currencies,
                  and accounts in one place.
                </p>
                <ul className="text-blue-100 text-xs space-y-1">
                  <li>
                    <i className="fas fa-check mr-2"></i>Multi-currency
                    valuations
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Automatic dividends
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Property & bank
                    accounts
                  </li>
                </ul>
                <div className="mt-4 flex items-center text-white font-medium">
                  View Net Worth
                  <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </Link>

            {/* Invest - Green */}
            <Link
              href="/rebalance/models"
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5"></div>
              <div className="relative">
                <div className="mb-4">
                  <i className="fas fa-balance-scale text-4xl text-white/90"></i>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Invest</h2>
                <p className="text-emerald-100 text-sm mb-4">
                  Define investment strategies with model portfolios and
                  rebalance to maintain target allocations.
                </p>
                <ul className="text-emerald-100 text-xs space-y-1">
                  <li>
                    <i className="fas fa-check mr-2"></i>Model portfolios
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Target allocations
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Portfolio rebalancing
                  </li>
                </ul>
                <div className="mt-4 flex items-center text-white font-medium">
                  View Models
                  <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </Link>

            {/* Retirement - Sunset */}
            <Link
              href="/retire"
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-rose-500 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5"></div>
              <div className="relative">
                <div className="mb-4">
                  <i className="fas fa-umbrella-beach text-4xl text-white/90"></i>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Retirement
                </h2>
                <p className="text-orange-100 text-sm mb-4">
                  Plan how to spend your wealth with withdrawal strategies and
                  see how long your money will last.
                </p>
                <ul className="text-orange-100 text-xs space-y-1">
                  <li>
                    <i className="fas fa-check mr-2"></i>Withdrawal strategies
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Inflation modeling
                  </li>
                  <li>
                    <i className="fas fa-check mr-2"></i>Longevity projections
                  </li>
                </ul>
                <div className="mt-4 flex items-center text-white font-medium">
                  Plan Retirement
                  <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </Link>
          </div>
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
