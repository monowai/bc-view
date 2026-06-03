import React from "react"
import Link from "next/link"
interface CompleteStepProps {
  portfolioName: string
  bankAccountCount: number
  propertyCount: number
  pensionCount: number
  insuranceCount: number
  portfolioId: string | null
  independencePlanCreated?: boolean
}

const CompleteStep: React.FC<CompleteStepProps> = ({
  portfolioName,
  bankAccountCount,
  propertyCount,
  pensionCount,
  insuranceCount,
  independencePlanCreated,
}) => {
  return (
    <div className="text-center py-6">
      <div className="text-5xl mb-6 text-green-500">
        <i className="fas fa-check-circle"></i>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {"You're all set!"}
      </h2>

      <p className="text-gray-600 mb-6">
        {"Your account has been set up successfully. Here's what was created:"}
      </p>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto">
        <ul className="text-left space-y-2">
          <li className="flex items-center text-gray-700">
            <i className="fas fa-folder text-blue-500 w-6"></i>
            <span>
              {"Portfolio:"} <strong>{portfolioName}</strong>
            </span>
          </li>
          {bankAccountCount > 0 && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-university text-blue-500 w-6"></i>
              <span>{`${bankAccountCount} bank account(s)`}</span>
            </li>
          )}
          {propertyCount > 0 && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-home text-green-500 w-6"></i>
              <span>{`${propertyCount} property(ies)`}</span>
            </li>
          )}
          {pensionCount > 0 && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-piggy-bank text-purple-500 w-6"></i>
              <span>{`${pensionCount} pension plan(s)`}</span>
            </li>
          )}
          {insuranceCount > 0 && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-shield-alt text-teal-500 w-6"></i>
              <span>{`${insuranceCount} insurance policy(ies)`}</span>
            </li>
          )}
          {independencePlanCreated && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-chart-line text-independence-500 w-6"></i>
              <span>
                {"Independence Plan created"}{" "}
                <Link
                  href="/independence"
                  className="text-independence-600 hover:underline"
                >
                  {"View plan"}
                </Link>
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* Follow-up: brokerage. Surfaced here (not on Welcome) so the user's
          existing bank-side picture is recorded into the default portfolio
          first. The wizard creates a fresh broker + portfolio for invested
          cash as a separate activity. */}
      <div className="mt-8 max-w-sm mx-auto bg-purple-50 border border-purple-200 rounded-lg p-4 text-left">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <i className="fas fa-building-columns text-purple-500"></i>
          {"Have a brokerage account?"}
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          {
            "Set up your broker, a brokerage portfolio and your opening cash deposit."
          }
        </p>
        <Link
          href="/tools/open-brokerage"
          className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          {"Open Brokerage wizard →"}
        </Link>
      </div>
    </div>
  )
}

export default CompleteStep
