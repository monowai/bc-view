import React from "react"
import Head from "next/head"
import Link from "next/link"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import StatementImport from "@components/features/brokers/statementImport/StatementImport"

function BrokerageImportPage(): React.ReactElement {
  return (
    <>
      <Head>
        <title>Import from image | Holdsworth</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center space-x-3">
            <Link
              href="/brokers"
              className="text-gray-500 hover:text-gray-700 p-1 -ml-1"
              aria-label="Back to brokerage accounts"
              title="Back to brokerage accounts"
            >
              <i className="fas fa-arrow-left text-lg" aria-hidden="true"></i>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Import from image
            </h1>
          </div>
        </div>
        <div className="px-4 py-4">
          <StatementImport />
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(BrokerageImportPage)
