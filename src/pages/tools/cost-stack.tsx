import Head from "next/head"
import Link from "next/link"
import React from "react"

export default function CostStackPage(): React.ReactElement {
  return (
    <>
      <Head>
        <title>Cost Stack — long-term fee impact | Holdsworth</title>
        <meta
          name="description"
          content="Compare investment fee structures side by side. See how a 1% TER, a 3% front-load, or an ILP wrapper drag on a 30-year compounding portfolio."
        />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {"Cost Stack"}
            </h1>
            <p className="text-gray-600 text-base">
              {
                "Compare investment fee structures side by side. Tweak the inputs — see what a 1% TER or a 3% front-load costs you over 30 years."
              }
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-8">
          <iframe
            src="/tools/cost-stack.html"
            title="Cost Stack interactive fee comparison"
            className="w-full h-[1600px] rounded-lg border border-gray-200 shadow-sm bg-[#0f1217]"
            loading="lazy"
          />
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              {"Track the real numbers, not the brochure."}
            </h2>
            <p className="text-gray-600 mb-6">
              {
                "Holdsworth tracks your portfolio across brokers and currencies so you can measure actual drag against the model above — and act on it."
              }
            </p>
            <Link href="/auth/login" className="btn-primary">
              {"Sign In"}
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
