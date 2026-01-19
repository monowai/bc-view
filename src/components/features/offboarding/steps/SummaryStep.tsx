import React from "react"
import { useTranslation } from "next-i18next"
import { OffboardingSummary } from "types/beancounter"

interface SummaryStepProps {
  summary: OffboardingSummary | null
  planCount: number
  modelCount: number
  loading: boolean
  onNext: () => void
}

export default function SummaryStep({
  summary,
  planCount,
  modelCount,
  loading,
  onNext,
}: SummaryStepProps): React.ReactElement {
  const { t } = useTranslation("offboarding")

  if (loading) {
    return (
      <div className="text-center py-8">
        <i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
        <p className="mt-2 text-gray-500">{t("loading")}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {t("summary.title")}
      </h2>
      <p className="text-gray-600 mb-6">{t("summary.description")}</p>

      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-folder text-blue-500 mr-3"></i>
            <span className="font-medium">{t("summary.portfolios")}</span>
          </div>
          <span className="text-lg font-semibold">
            {summary?.portfolioCount ?? 0}
          </span>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-home text-green-500 mr-3"></i>
            <span className="font-medium">{t("summary.assets")}</span>
          </div>
          <span className="text-lg font-semibold">
            {summary?.assetCount ?? 0}
          </span>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-chart-line text-purple-500 mr-3"></i>
            <span className="font-medium">{t("summary.plans")}</span>
          </div>
          <span className="text-lg font-semibold">{planCount}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-balance-scale text-indigo-500 mr-3"></i>
            <span className="font-medium">{t("summary.models")}</span>
          </div>
          <span className="text-lg font-semibold">{modelCount}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-percent text-orange-500 mr-3"></i>
            <span className="font-medium">{t("summary.taxRates")}</span>
          </div>
          <span className="text-lg font-semibold">
            {summary?.taxRateCount ?? 0}
          </span>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <i className="fas fa-exclamation-triangle text-yellow-500 mr-3 mt-1"></i>
          <p className="text-yellow-700 text-sm">{t("summary.warning")}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          {t("continue")}
        </button>
      </div>
    </div>
  )
}
