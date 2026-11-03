import React from "react"
import {
  BankAccount,
  Property,
  Pension,
  Insurance,
} from "@components/features/onboarding/OnboardingWizard"

interface ReviewStepProps {
  baseCurrency: string
  bankAccounts: BankAccount[]
  properties: Property[]
  pensions: Pension[]
  insurances: Insurance[]
  onRemoveBankAccount: (index: number) => void
  onRemoveProperty: (index: number) => void
  onRemovePension: (index: number) => void
  onRemoveInsurance: (index: number) => void
}

const NAME_CELL = "px-4 py-3 text-sm text-gray-900"
const MUTED_CELL = "px-4 py-3 text-sm text-gray-600"
const AMOUNT_CELL = "px-4 py-3 text-sm text-gray-900 text-right"

const ReviewSection: React.FC<{
  icon: string
  title: string
  columns: { label: string; right?: boolean }[]
  children: React.ReactNode
}> = ({ icon, title, columns, children }) => (
  <div>
    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
      <i className={`fas ${icon}`}></i>
      {title}
    </h3>
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-100">
          <tr>
            {columns.map(({ label, right }) => (
              <th
                key={label}
                className={`px-4 py-2 ${right ? "text-right" : "text-left"} text-xs font-medium text-gray-500 uppercase`}
              >
                {label}
              </th>
            ))}
            <th className="px-4 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">{children}</tbody>
      </table>
    </div>
  </div>
)

const ReviewRow: React.FC<{
  onRemove: () => void
  children: React.ReactNode
}> = ({ onRemove, children }) => (
  <tr className="hover:bg-gray-100">
    {children}
    <td className="px-4 py-3 text-center">
      <button
        type="button"
        onClick={onRemove}
        className="text-red-500 hover:text-red-700"
        title={"Remove"}
      >
        <i className="fas fa-trash-alt"></i>
      </button>
    </td>
  </tr>
)

const ReviewStep: React.FC<ReviewStepProps> = ({
  baseCurrency,
  bankAccounts,
  properties,
  pensions,
  insurances,
  onRemoveBankAccount,
  onRemoveProperty,
  onRemovePension,
  onRemoveInsurance,
}) => {
  const hasAssets =
    bankAccounts.length > 0 ||
    properties.length > 0 ||
    pensions.length > 0 ||
    insurances.length > 0

  const formatCurrency = (
    amount: number | undefined,
    currency: string,
  ): string => {
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
          {"Review Your Setup"}
        </h2>
        <p className="text-gray-600">
          {
            "Please review the assets below. You can remove any items before completing setup."
          }
        </p>
      </div>

      {!hasAssets ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-inbox text-4xl mb-4"></i>
          <p>
            {
              "No assets to create. You can go back to add some or continue with just the portfolio."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bank Accounts */}
          {bankAccounts.length > 0 && (
            <ReviewSection
              icon="fa-university text-blue-500 mr-2"
              title={"Bank Accounts"}
              columns={[
                { label: "Name" },
                { label: "Currency" },
                { label: "Balance", right: true },
              ]}
            >
              {bankAccounts.map((account, index) => (
                <ReviewRow
                  key={index}
                  onRemove={() => onRemoveBankAccount(index)}
                >
                  <td className={NAME_CELL}>{account.name}</td>
                  <td className={MUTED_CELL}>{account.currency}</td>
                  <td className={AMOUNT_CELL}>
                    {formatCurrency(account.balance, account.currency)}
                  </td>
                </ReviewRow>
              ))}
            </ReviewSection>
          )}

          {/* Properties */}
          {properties.length > 0 && (
            <ReviewSection
              icon="fa-home text-green-500 mr-2"
              title={"Properties"}
              columns={[
                { label: "Name" },
                { label: "Purchase Price", right: true },
                { label: "Current Value", right: true },
              ]}
            >
              {properties.map((property, index) => (
                <ReviewRow key={index} onRemove={() => onRemoveProperty(index)}>
                  <td className={NAME_CELL}>{property.name}</td>
                  <td className={AMOUNT_CELL}>
                    {formatCurrency(property.price, baseCurrency)}
                  </td>
                  <td className={AMOUNT_CELL}>
                    {formatCurrency(
                      property.value || property.price,
                      baseCurrency,
                    )}
                  </td>
                </ReviewRow>
              ))}
            </ReviewSection>
          )}

          {/* Pensions */}
          {pensions.length > 0 && (
            <ReviewSection
              icon="fa-piggy-bank text-purple-500 mr-2"
              title={"Pension Plans"}
              columns={[
                { label: "Name" },
                { label: "Currency" },
                { label: "Balance", right: true },
                { label: "Payout Age", right: true },
              ]}
            >
              {pensions.map((pension, index) => (
                <ReviewRow key={index} onRemove={() => onRemovePension(index)}>
                  <td className={NAME_CELL}>
                    {pension.name}
                    {pension.policyType && (
                      <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                        {pension.policyType}
                      </span>
                    )}
                    {pension.lumpSum && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                        lump sum
                      </span>
                    )}
                  </td>
                  <td className={MUTED_CELL}>{pension.currency}</td>
                  <td className={AMOUNT_CELL}>
                    {formatCurrency(pension.balance, pension.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {pension.payoutAge || "-"}
                  </td>
                </ReviewRow>
              ))}
            </ReviewSection>
          )}

          {/* Life Insurance */}
          {insurances.length > 0 && (
            <ReviewSection
              icon="fa-shield-alt text-teal-500 mr-2"
              title={"Life Insurance"}
              columns={[
                { label: "Name" },
                { label: "Currency" },
                { label: "Cash Value", right: true },
                { label: "Payout", right: true },
              ]}
            >
              {insurances.map((insurance, index) => (
                <ReviewRow
                  key={index}
                  onRemove={() => onRemoveInsurance(index)}
                >
                  <td className={NAME_CELL}>
                    {insurance.name}
                    {insurance.lumpSum && (
                      <span className="ml-2 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                        lump sum
                      </span>
                    )}
                  </td>
                  <td className={MUTED_CELL}>{insurance.currency}</td>
                  <td className={AMOUNT_CELL}>
                    {formatCurrency(insurance.currentValue, insurance.currency)}
                  </td>
                  <td className={AMOUNT_CELL}>
                    {formatCurrency(insurance.payoutAmount, insurance.currency)}
                    {insurance.payoutAge && (
                      <span className="text-gray-500 ml-1">
                        @ {insurance.payoutAge}
                      </span>
                    )}
                  </td>
                </ReviewRow>
              ))}
            </ReviewSection>
          )}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <i className="fas fa-info-circle mr-2"></i>
          {
            "Click 'Continue' to proceed with your setup. You can still make changes in the next step."
          }
        </p>
      </div>
    </div>
  )
}

export default ReviewStep
