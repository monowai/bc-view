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

  const { data: portfolioData } = useSwr<{ data: Portfolio[] }>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const hasPortfolios = (portfolioData?.data?.length ?? 0) > 0

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              {t("home.welcome")}{" "}
              <span className="text-blue-600">{displayName}</span>
            </h1>
            <p className="text-gray-600 mb-6">
              Your complete wealth management platform
            </p>
            {hasPortfolios ? (
              <Link
                href="/wealth"
                className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                <i className="fas fa-coins mr-2"></i>
                View Net Worth
              </Link>
            ) : (
              <Link
                href="/portfolios"
                className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                <i className="fas fa-plus mr-2"></i>
                Create Your First Portfolio
              </Link>
            )}
          </div>
        </div>

        {/* Capabilities Grid */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center mb-2">
                <i className="fas fa-layer-group text-blue-600 mr-2"></i>
                <h3 className="font-medium text-gray-900">All Your Assets</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Stocks, ETFs, property, bank accounts with automatic valuations.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center mb-2">
                <i className="fas fa-globe text-green-600 mr-2"></i>
                <h3 className="font-medium text-gray-900">Multi-Currency</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Hold assets in any currency with real-time FX conversion.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center mb-2">
                <i className="fas fa-chart-line text-purple-600 mr-2"></i>
                <h3 className="font-medium text-gray-900">XIRR Analytics</h3>
              </div>
              <p className="text-gray-600 text-sm">
                True annualized returns accounting for investment timing.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center mb-2">
                <i className="fas fa-calendar-check text-amber-600 mr-2"></i>
                <h3 className="font-medium text-gray-900">Corporate Actions</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Dividends and stock splits tracked automatically.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center mb-2">
                <i className="fas fa-umbrella-beach text-orange-600 mr-2"></i>
                <h3 className="font-medium text-gray-900">Retirement</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Model scenarios with expenses and inflation projections.
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center mb-2">
                <i className="fas fa-balance-scale text-violet-600 mr-2"></i>
                <h3 className="font-medium text-gray-900">Rebalancing</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Target allocations with buy/sell recommendations.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-center gap-12 text-center">
              <div>
                <div className="text-xl font-bold text-blue-600">15+</div>
                <div className="text-xs text-gray-600">Currencies</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">50+</div>
                <div className="text-xs text-gray-600">Markets</div>
              </div>
              <div>
                <div className="text-xl font-bold text-purple-600">XIRR</div>
                <div className="text-xs text-gray-600">Analytics</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-600">
                  <i className="fas fa-lock"></i>
                </div>
                <div className="text-xs text-gray-600">Secure</div>
              </div>
            </div>
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
