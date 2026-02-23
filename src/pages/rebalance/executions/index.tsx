import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import ExecutionList from "@components/features/rebalance/execution/ExecutionList"

function ExecutionsPage(): React.ReactElement {
  return (
    <div className="w-full py-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/rebalance" className="hover:text-invest-600">
          {"Rebalance Position"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{"Executions"}</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {"Saved Executions"}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {"Resume or review your saved execution plans"}
          </p>
        </div>
      </div>

      {/* Executions List */}
      <ExecutionList />
    </div>
  )
}

export default withPageAuthRequired(ExecutionsPage)
