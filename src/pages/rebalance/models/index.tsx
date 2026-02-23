import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import ModelPortfolioList from "@components/features/rebalance/models/ModelPortfolioList"

function ModelsPage(): React.ReactElement {
  const router = useRouter()

  return (
    <div className="w-full py-4">
      {/* Breadcrumb - Model Portfolios is the entry point of the rebalancing flow */}
      <nav className="text-sm text-gray-500 mb-4">
        <span className="text-gray-900 font-medium">{"Model Portfolios"}</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {"Model Portfolios"}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {"Define target allocations for rebalancing"}
          </p>
        </div>
        <button
          onClick={() => router.push("/rebalance/models/__NEW__")}
          className="bg-invest-600 text-white px-4 py-2 rounded hover:bg-invest-700 transition-colors flex items-center"
        >
          <i className="fas fa-plus mr-2"></i>
          {"Create Model"}
        </button>
      </div>

      {/* Models List */}
      <ModelPortfolioList />
    </div>
  )
}

export default withPageAuthRequired(ModelsPage)
