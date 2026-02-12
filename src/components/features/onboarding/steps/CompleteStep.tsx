import React from "react"
import Link from "next/link"
import { useTranslation } from "next-i18next"

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
  const { t } = useTranslation("onboarding")

  return (
    <div className="text-center py-6">
      <div className="text-5xl mb-6 text-green-500">
        <i className="fas fa-check-circle"></i>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {t("complete.title", "You're all set!")}
      </h2>

      <p className="text-gray-600 mb-6">
        {t(
          "complete.description",
          "Your account has been set up successfully. Here's what was created:",
        )}
      </p>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto">
        <ul className="text-left space-y-2">
          <li className="flex items-center text-gray-700">
            <i className="fas fa-folder text-blue-500 w-6"></i>
            <span>
              {t("complete.portfolio", "Portfolio:")}{" "}
              <strong>{portfolioName}</strong>
            </span>
          </li>
          {bankAccountCount > 0 && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-university text-blue-500 w-6"></i>
              <span>
                {t("complete.bankAccounts", "{{count}} bank account(s)", {
                  count: bankAccountCount,
                })}
              </span>
            </li>
          )}
          {propertyCount > 0 && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-home text-green-500 w-6"></i>
              <span>
                {t("complete.properties", "{{count}} property(ies)", {
                  count: propertyCount,
                })}
              </span>
            </li>
          )}
          {pensionCount > 0 && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-piggy-bank text-purple-500 w-6"></i>
              <span>
                {t("complete.pensions", "{{count}} pension plan(s)", {
                  count: pensionCount,
                })}
              </span>
            </li>
          )}
          {insuranceCount > 0 && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-shield-alt text-teal-500 w-6"></i>
              <span>
                {t("complete.insurances", "{{count}} insurance policy(ies)", {
                  count: insuranceCount,
                })}
              </span>
            </li>
          )}
          {independencePlanCreated && (
            <li className="flex items-center text-gray-700">
              <i className="fas fa-chart-line text-independence-500 w-6"></i>
              <span>
                {t(
                  "complete.independencePlan",
                  "Independence Plan created",
                )}{" "}
                <Link
                  href="/independence"
                  className="text-independence-600 hover:underline"
                >
                  {t("complete.viewPlan", "View plan")}
                </Link>
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

export default CompleteStep
