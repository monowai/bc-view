import React from "react"
import { useTranslation } from "next-i18next"

interface PortfolioStepProps {
  portfolioCode: string
  portfolioName: string
  baseCurrency: string
  reportingCurrency: string
  onCodeChange: (code: string) => void
  onNameChange: (name: string) => void
}

const PortfolioStep: React.FC<PortfolioStepProps> = ({
  portfolioCode,
  portfolioName,
  baseCurrency,
  reportingCurrency,
  onCodeChange,
  onNameChange,
}) => {
  const { t } = useTranslation("onboarding")

  const handleCodeChange = (value: string): void => {
    // Auto-uppercase and remove spaces
    onCodeChange(value.toUpperCase().replace(/\s+/g, ""))
  }

  return (
    <div className="py-4">
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {t("portfolio.title", "Create your first portfolio")}
      </h2>

      <p className="text-gray-600 mb-6">
        {t(
          "portfolio.description",
          "A portfolio groups your investments together. You might have separate portfolios for different goals like retirement, savings, or trading.",
        )}
      </p>

      {/* Currency summary from previous step */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          {t("portfolio.currencySettings", "Currency Settings")}
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-600">
              {t("portfolio.baseCurrency", "Base Currency")}:
            </span>
            <span className="ml-2 font-medium text-blue-900">
              {baseCurrency}
            </span>
          </div>
          <div>
            <span className="text-blue-600">
              {t("portfolio.reportingCurrency", "Reporting Currency")}:
            </span>
            <span className="ml-2 font-medium text-blue-900">
              {reportingCurrency}
            </span>
          </div>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          {t(
            "portfolio.currencyNote",
            "Your portfolio will use these currencies for tracking and reporting.",
          )}
        </p>
      </div>

      <div className="max-w-md space-y-4">
        <div>
          <label
            htmlFor="portfolioCode"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t("portfolio.codeLabel", "Portfolio Code")}
          </label>
          <input
            type="text"
            id="portfolioCode"
            value={portfolioCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder={t("portfolio.codePlaceholder", "PERSONAL")}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
            maxLength={20}
          />
          <p className="text-sm text-gray-500 mt-1">
            {t(
              "portfolio.codeHint",
              "Short code used in URLs (e.g., PERSONAL, RETIRE, TRADE)",
            )}
          </p>
        </div>

        <div>
          <label
            htmlFor="portfolioName"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t("portfolio.nameLabel", "Portfolio Name")}
          </label>
          <input
            type="text"
            id="portfolioName"
            value={portfolioName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("portfolio.namePlaceholder", "Personal Investments")}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">
            {t(
              "portfolio.nameHint",
              "Descriptive name (e.g., Personal Investments, Retirement Fund)",
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default PortfolioStep
