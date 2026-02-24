import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import Link from "next/link"
import OffboardingWizard from "@components/features/offboarding/OffboardingWizard"

function OffboardingPage(): React.ReactElement {
  return (
    <>
      <Head>
        <title>{"Remove Your Data"} | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <Link
              href="/"
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              {"Back to Home"}
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {"Remove Your Data"}
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              {
                "Choose what you'd like to remove from Beancounter. This action cannot be undone."
              }
            </p>
          </div>

          <OffboardingWizard />
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(OffboardingPage)
