import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import Link from "next/link"
import WizardContainer from "@components/features/retire/WizardContainer"

function RetirementWizard(): React.ReactElement {
  return (
    <>
      <Head>
        <title>Create Retirement Plan | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <Link
              href="/retire"
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Plans
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Create Your Retirement Plan
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Answer a few questions about your retirement goals and we&apos;ll
              help you understand your financial runway. This process takes
              about 5 minutes.
            </p>
          </div>

          <WizardContainer />
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(RetirementWizard)
