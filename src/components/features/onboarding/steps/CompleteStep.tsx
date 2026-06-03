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
  brokerageCreated?: boolean
}

const CompleteStep: React.FC<CompleteStepProps> = ({
  portfolioName,
  bankAccountCount,
  propertyCount,
  pensionCount,
  insuranceCount,
  independencePlanCreated,
  brokerageCreated,
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
          {brokerageCreated && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-building-columns text-purple-500 w-6"></i>
              <span>{"Brokerage set up"}</span>
            </li>
          )}
        </ul>
      </div>

      {/* Where to go next. The brokerage CTA used to live here as a
          stand-alone card; now that step 7 captures one brokerage inline,
          this section just points at the menus for ongoing additions. */}
      <div className="mt-8 max-w-md mx-auto text-left text-sm text-gray-700 space-y-3">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <i className="fas fa-building-columns text-purple-500"></i>
            {"Add more brokerage accounts"}
          </div>
          <p className="text-gray-600">
            {"Open the "}
            <strong>Tools</strong>
            {" menu → "}
            <strong>Open Brokerage</strong>
            {" any time to add another broker, portfolio and opening cash deposit."}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <i className="fas fa-coins text-blue-500"></i>
            {"Track assets Beancounter doesn't natively support"}
          </div>
          <p className="text-gray-600">
            {"Use the "}
            <strong>Wealth</strong>
            {" menu to record private holdings — collectibles, alt-investments, anything off-market — as cash-balance assets in your portfolios."}
          </p>
        </div>
      </div>
    </div>
  )
}

export default CompleteStep
