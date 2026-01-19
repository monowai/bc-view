import React from "react"
import { useTranslation } from "next-i18next"
import { OffboardingSummary } from "types/beancounter"

interface WealthStepProps {
  summary: OffboardingSummary | null
  deleteWealth: boolean
  setDeleteWealth: (value: boolean) => void
  onBack: () => void
  onNext: () => void
}

export default function WealthStep({
  summary,
  deleteWealth,
  setDeleteWealth,
  onBack,
  onNext,
}: WealthStepProps): React.ReactElement {
  const { t } = useTranslation("offboarding")
  const portfolioCount = summary?.portfolioCount ?? 0
  const assetCount = summary?.assetCount ?? 0
  const hasData = portfolioCount > 0 || assetCount > 0

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {t("wealth.title")}
      </h2>
      <p className="text-gray-600 mb-6">{t("wealth.description")}</p>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-folder text-blue-500 mr-3"></i>
            <span>{t("wealth.portfolios")}</span>
          </div>
          <span className="font-semibold">{portfolioCount}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-home text-green-500 mr-3"></i>
            <span>{t("wealth.assets")}</span>
          </div>
          <span className="font-semibold">{assetCount}</span>
        </div>
      </div>

      {hasData ? (
        <div className="border border-gray-200 rounded-lg p-4 mb-6">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={deleteWealth}
              onChange={(e) => setDeleteWealth(e.target.checked)}
              className="mt-1 h-5 w-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
            />
            <div className="ml-3">
              <span className="font-medium text-gray-900">
                {t("wealth.checkbox")}
              </span>
              <p className="text-sm text-gray-500 mt-1">
                {t("wealth.checkboxDescription")}
              </p>
            </div>
          </label>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <i className="fas fa-info-circle text-gray-400 mr-3"></i>
            <p className="text-gray-600">{t("wealth.noData")}</p>
          </div>
        </div>
      )}

      {deleteWealth && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <i className="fas fa-exclamation-circle text-red-500 mr-3 mt-1"></i>
            <div>
              <p className="text-red-700 font-medium">
                {t("wealth.warningTitle")}
              </p>
              <p className="text-red-600 text-sm mt-1">
                {t("wealth.warningDescription")}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          {t("back")}
        </button>
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
