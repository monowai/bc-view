import React from "react"
import { useTranslation } from "next-i18next"
import { OffboardingResult } from "types/beancounter"
import Link from "next/link"

interface CompleteStepProps {
  results: OffboardingResult[]
  accountDeleted: boolean
}

export default function CompleteStep({
  results,
  accountDeleted,
}: CompleteStepProps): React.ReactElement {
  const { t } = useTranslation("offboarding")

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-check text-2xl text-green-600"></i>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          {t("complete.title")}
        </h2>
        <p className="text-gray-600 mt-2">{t("complete.description")}</p>
      </div>

      <div className="space-y-4 mb-8">
        {results.map((result, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-4 rounded-lg ${
              result.success ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <div className="flex items-center">
              <i
                className={`fas ${result.success ? "fa-check-circle text-green-500" : "fa-times-circle text-red-500"} mr-3`}
              ></i>
              <span className="font-medium capitalize">{result.type}</span>
            </div>
            <span className="text-gray-600">
              {result.deletedCount} {t("complete.deleted")}
            </span>
          </div>
        ))}
      </div>

      {accountDeleted ? (
        <div className="text-center">
          <p className="text-gray-600 mb-4">{t("complete.accountDeleted")}</p>
          {/* Using <a> intentionally - /auth/logout requires full page navigation for Auth0 logout flow */}
          {}
          <a
            href="/auth/logout"
            className="inline-flex items-center px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>
            {t("complete.logout")}
          </a>
        </div>
      ) : (
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <i className="fas fa-home mr-2"></i>
            {t("complete.returnHome")}
          </Link>
        </div>
      )}
    </div>
  )
}
