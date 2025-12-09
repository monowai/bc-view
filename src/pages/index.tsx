import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import Image from "next/image"
import React from "react"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

// Capitalize first letter of a string
const capitalize = (str: string): string =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : ""

export default withPageAuthRequired(function Home(): React.ReactElement {
  const { user, error, isLoading } = useUser()
  const { t } = useTranslation("common")

  // Get display name: prefer nickname, fall back to name
  const displayName = user?.nickname
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
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                {t("home.welcome")}{" "}
                <span className="text-blue-600">{displayName}</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                {t("tagline")} - Track your investments, manage portfolios, and
                make informed financial decisions.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Portfolio Management */}
            <Link href="/portfolios" className="group">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-blue-200">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg mr-4">
                    <i className="fas fa-chart-pie text-2xl text-blue-600"></i>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {t("home.portfolios")}
                  </h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Manage your investment portfolios with real-time tracking and
                  performance analytics.
                </p>
                <div className="flex items-center text-blue-600 group-hover:text-blue-700">
                  <span className="font-medium">Get Started</span>
                  <i className="fas fa-arrow-right ml-2 transform group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </Link>

            {/* Holdings & Analytics */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-green-100 rounded-lg mr-4">
                  <i className="fas fa-chart-line text-2xl text-green-600"></i>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Holdings & Analytics
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                Track holdings with XIRR calculations, ROI analysis, and
                end-of-day market valuations.
              </p>
              <div className="flex items-center text-green-600">
                <span className="font-medium">Available Now</span>
                <i className="fas fa-check ml-2"></i>
              </div>
            </div>

            {/* Transaction Management */}
            <Link href="/trns" className="group">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-100 hover:border-purple-200">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-purple-100 rounded-lg mr-4">
                    <i className="fas fa-exchange-alt text-2xl text-purple-600"></i>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Transactions
                  </h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Record and manage trades, dividends, and cash movements across
                  multiple currencies.
                </p>
                <div className="flex items-center text-purple-600 group-hover:text-purple-700">
                  <span className="font-medium">Manage Trades</span>
                  <i className="fas fa-arrow-right ml-2 transform group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            </Link>

            {/* Advanced Analytics (Coming Soon) */}
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl shadow-lg p-8 border border-orange-100 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full font-medium">
                  Coming Soon
                </span>
              </div>
              <div className="flex items-center mb-4">
                <div className="p-3 bg-orange-100 rounded-lg mr-4">
                  <i className="fas fa-chart-bar text-2xl text-orange-600"></i>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Advanced Analytics
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                Enhanced portfolio analysis with sector allocation, performance
                benchmarking, and risk metrics.
              </p>
              <div className="flex items-center text-orange-600">
                <span className="font-medium">In Development</span>
                <i className="fas fa-clock ml-2"></i>
              </div>
            </div>

            {/* AI Insights (Coming Soon) */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-8 border border-indigo-100 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-1 rounded-full font-medium">
                  Coming Soon
                </span>
              </div>
              <div className="flex items-center mb-4">
                <div className="p-3 bg-indigo-100 rounded-lg mr-4">
                  <i className="fas fa-brain text-2xl text-indigo-600"></i>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  AI Investment Insights
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                Intelligent analysis and recommendations based on your portfolio
                performance and market trends.
              </p>
              <div className="flex items-center text-indigo-600">
                <span className="font-medium">Planned Feature</span>
                <i className="fas fa-lightbulb ml-2"></i>
              </div>
            </div>

            {/* Mobile App (Coming Soon) */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl shadow-lg p-8 border border-teal-100 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="bg-teal-100 text-teal-600 text-xs px-2 py-1 rounded-full font-medium">
                  Coming Soon
                </span>
              </div>
              <div className="flex items-center mb-4">
                <div className="p-3 bg-teal-100 rounded-lg mr-4">
                  <i className="fas fa-mobile-alt text-2xl text-teal-600"></i>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Mobile App
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                Native mobile apps for iOS and Android with offline capabilities
                and push notifications.
              </p>
              <div className="flex items-center text-teal-600">
                <span className="font-medium">In Planning</span>
                <i className="fas fa-rocket ml-2"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  Multi-Currency
                </div>
                <div className="text-gray-600">EUR, USD, GBP & more</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">
                  XIRR Analytics
                </div>
                <div className="text-gray-600">
                  Accurate performance tracking
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  Secure
                </div>
                <div className="text-gray-600">Bank-grade security</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  Open Source
                </div>
                <div className="text-gray-600">Transparent & extensible</div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Link */}
        <div className="bg-gray-50 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between">
              <div className="flex items-center mb-4 sm:mb-0">
                <Image
                  src={user.picture || "/default-avatar.png"}
                  alt={user.name || "User"}
                  width={40}
                  height={40}
                  className="rounded-full mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-600">{user.email}</div>
                </div>
              </div>
              <div className="flex space-x-4">
                <Link
                  href="/profile"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t("user.profile")}
                </Link>
                <Link
                  href="/api/auth/logout"
                  className="text-gray-600 hover:text-gray-700 font-medium"
                >
                  {t("user.logout")}
                </Link>
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
