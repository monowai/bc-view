import Link from "next/link"
import React from "react"

export default function LearnWealth(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-blue-600 mb-6">
            <i className="fas fa-coins text-3xl text-white"></i>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {"Manage Wealth"}
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed">
            {
              "See your net worth across brokers, assets and currencies in one place. Multi-currency, multi-broker, multi-asset — all the moving parts, one consistent view."
            }
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-10">
          <h2 className="font-semibold text-gray-900 mb-2">
            {"Curious what fees actually cost you?"}
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            {
              "Try our interactive fee-impact calculator. Compare bank UTs, robos, brokerage + DIY and ILPs over 30 years."
            }
          </p>
          <Link
            href="/tools/cost-stack"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {"Open Cost Stack"}
            <i className="fas fa-arrow-right ml-2"></i>
          </Link>
        </div>

        <div className="text-center">
          <Link href="/auth/login" className="btn-primary">
            {"Sign In"}
          </Link>
        </div>
      </div>
    </div>
  )
}
