import React from "react"
import { useTranslation } from "next-i18next"

interface CompleteStepProps {
  portfolioName: string
  bankAccountCount: number
  propertyCount: number
  portfolioId: string | null
}

const CompleteStep: React.FC<CompleteStepProps> = ({
  portfolioName,
  bankAccountCount,
  propertyCount,
}) => {
  const { t } = useTranslation("onboarding")

  const handleDownloadTemplate = (): void => {
    // Trigger download of the CSV template
    const link = document.createElement("a")
    link.href = "/templates/example-transactions.csv"
    link.download = "example-transactions.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
      <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto mb-8">
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
        </ul>
      </div>

      {/* CSV Template Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
        <h3 className="font-medium text-blue-900 mb-2">
          {t("complete.csvTitle", "Import Your Transactions")}
        </h3>
        <p className="text-sm text-blue-700 mb-4">
          {t(
            "complete.csvDescription",
            "Download our example CSV to see the format for importing transactions like deposits and stock purchases.",
          )}
        </p>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <i className="fas fa-download mr-2"></i>
          {t("complete.downloadCsv", "Download CSV Template")}
        </button>
      </div>
    </div>
  )
}

export default CompleteStep
