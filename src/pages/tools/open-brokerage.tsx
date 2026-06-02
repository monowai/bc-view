import Head from "next/head"
import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import OpenBrokerageWizard from "@components/features/openBrokerage/OpenBrokerageWizard"

function OpenBrokeragePage(): React.ReactElement {
  return (
    <>
      <Head>
        <title>Open Brokerage | Holdsworth</title>
        <meta
          name="description"
          content="Guided wizard to create a broker, a brokerage portfolio, and an optional opening cash deposit (with a paired withdrawal from a source portfolio if you supply one)."
        />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <OpenBrokerageWizard />
      </div>
    </>
  )
}

export default withPageAuthRequired(OpenBrokeragePage)
