import React from "react"
import Head from "next/head"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import SetupWizard from "@components/features/independence/setup/SetupWizard"

/**
 * "Get started" from the /independence empty state. A guided, step-by-step
 * plan builder — the same questions onboarding asks, just for the plan — that
 * finishes the job: the stage it creates is phased into a journey before the
 * user is handed back, so this door and the "Set it up myself" wizard door end
 * in the same place.
 */
function IndependenceSetupPage(): React.ReactElement {
  return (
    <>
      <Head>
        <title>{"Create your independence plan"}</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <SetupWizard />
      </div>
    </>
  )
}

export default withPageAuthRequired(IndependenceSetupPage)
