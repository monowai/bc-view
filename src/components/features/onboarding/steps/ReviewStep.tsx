import React from "react"
import { useTranslation } from "next-i18next"
import {
  BankAccount,
  Property,
  Pension,
} from "@components/features/onboarding/OnboardingWizard"

interface ReviewStepProps {
  baseCurrency: string
  bankAccounts: BankAccount[]
  properties: Property[]
  pensions: Pension[]
  onRemoveBankAccount: (index: number) => void
  onRemoveProperty: (index: number) => void
  onRemovePension: (index: number) => void
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  baseCurrency,
  bankAccounts,
  properties,
  pensions,
  onRemoveBankAccount,
  onRemoveProperty,
  onRemovePension,
}) => {
  const { t } = useTranslation("onboarding")

  const hasAssets =
    bankAccounts.length > 0 || properties.length > 0 || pensions.length > 0

  const formatCurrency = (amount: number | undefined, currency: string) => {
    if (amount === undefined) return "-"
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t("review.title", "Review Your Setup")}
        </h2>
        <p className="text-gray-600">
          {t(
            "review.description",
            "Please review the assets below. You can remove any items before completing setup.",
          )}
        </p>
      </div>

      {!hasAssets ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-inbox text-4xl mb-4"></i>
          <p>
            {t(
              "review.noAssets",
              "No assets to create. You can go back to add some or continue with just the portfolio.",
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bank Accounts */}
          {bankAccounts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <i className="fas fa-university text-blue-500 mr-2"></i>
                {t("review.bankAccounts", "Bank Accounts")}
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("review.name", "Name")}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("review.currency", "Currency")}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("review.balance", "Balance")}
                      </th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bankAccounts.map((account, index) => (
                      <tr key={index} className="hover:bg-gray-100">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {account.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {account.currency}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatCurrency(account.balance, account.currency)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveBankAccount(index)}
                            className="text-red-500 hover:text-red-700"
                            title={t("review.remove", "Remove")}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Properties */}
          {properties.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <i className="fas fa-home text-green-500 mr-2"></i>
                {t("review.properties", "Properties")}
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("review.name", "Name")}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("review.purchasePrice", "Purchase Price")}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("review.currentValue", "Current Value")}
                      </th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {properties.map((property, index) => (
                      <tr key={index} className="hover:bg-gray-100">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {property.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatCurrency(property.price, baseCurrency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatCurrency(
                            property.value || property.price,
                            baseCurrency,
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveProperty(index)}
                            className="text-red-500 hover:text-red-700"
                            title={t("review.remove", "Remove")}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pensions */}
          {pensions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <i className="fas fa-piggy-bank text-purple-500 mr-2"></i>
                {t("review.pensions", "Pension Plans")}
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("review.name", "Name")}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("review.currency", "Currency")}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("review.balance", "Balance")}
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("review.payoutAge", "Payout Age")}
                      </th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pensions.map((pension, index) => (
                      <tr key={index} className="hover:bg-gray-100">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {pension.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {pension.currency}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatCurrency(pension.balance, pension.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {pension.payoutAge || "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => onRemovePension(index)}
                            className="text-red-500 hover:text-red-700"
                            title={t("review.remove", "Remove")}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <i className="fas fa-info-circle mr-2"></i>
          {t(
            "review.info",
            "Click 'Complete Setup' to create your portfolio and assets. This may take a moment.",
          )}
        </p>
      </div>
    </div>
  )
}

export default ReviewStep
