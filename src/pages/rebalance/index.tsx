import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import Link from "next/link"
import RebalancePlanList from "@components/features/rebalance/plans/RebalancePlanList"

function RebalancePage(): React.ReactElement {
  const router = useRouter()

  return (
    <div className="w-full py-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {"Rebalance Position"}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {"Manage model portfolios and rebalance plans"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/rebalance/models"
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors flex items-center"
          >
            <i className="fas fa-chart-pie mr-2"></i>
            {"Model Portfolios"}
          </Link>
          <Link
            href="/rebalance/executions"
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors flex items-center"
          >
            <i className="fas fa-tasks mr-2"></i>
            {"Executions"}
          </Link>
          <button
            onClick={() => router.push("/rebalance/wizard")}
            className="bg-invest-500 text-white px-4 py-2 rounded hover:bg-invest-600 transition-colors flex items-center"
          >
            <i className="fas fa-plus mr-2"></i>
            {"Create Plan"}
          </button>
        </div>
      </div>

      {/* Plans List */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          {"Rebalance Plans"}
        </h2>
        <RebalancePlanList />
      </div>
    </div>
  )
}

export default withPageAuthRequired(RebalancePage)
