import Link from "next/link"
import React from "react"

export default function LearnStrategy(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-700 mb-6">
            <i className="fas fa-balance-scale text-3xl text-white"></i>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {"Investment Strategy"}
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed">
            {
              "Turn goals and assets into coherent, rebalanceable investment strategies. Model portfolios, invest cash against targets, and rebalance back to plan as the market drifts."
            }
          </p>
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
