import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { BankAccount, Property } from "../OnboardingWizard"

interface AssetsStepProps {
  baseCurrency: string
  bankAccounts: BankAccount[]
  properties: Property[]
  onBankAccountsChange: (accounts: BankAccount[]) => void
  onPropertiesChange: (properties: Property[]) => void
}

const CURRENCIES = ["NZD", "USD", "AUD", "GBP", "EUR", "SGD", "CAD", "JPY"]

const AssetsStep: React.FC<AssetsStepProps> = ({
  baseCurrency,
  bankAccounts,
  properties,
  onBankAccountsChange,
  onPropertiesChange,
}) => {
  const { t } = useTranslation("onboarding")

  // Form state for new entries
  const [newAccount, setNewAccount] = useState<BankAccount>({
    name: "",
    currency: baseCurrency,
    balance: undefined,
  })
  const [newProperty, setNewProperty] = useState<Property>({
    name: "",
    price: 0,
    value: undefined,
  })

  const addBankAccount = (): void => {
    if (newAccount.name.trim()) {
      onBankAccountsChange([...bankAccounts, { ...newAccount }])
      setNewAccount({ name: "", currency: baseCurrency, balance: undefined })
    }
  }

  const removeBankAccount = (index: number): void => {
    onBankAccountsChange(bankAccounts.filter((_, i) => i !== index))
  }

  const addProperty = (): void => {
    if (newProperty.name.trim() && newProperty.price > 0) {
      onPropertiesChange([...properties, { ...newProperty }])
      setNewProperty({ name: "", price: 0, value: undefined })
    }
  }

  const removeProperty = (index: number): void => {
    onPropertiesChange(properties.filter((_, i) => i !== index))
  }

  return (
    <div className="py-4">
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {t("assets.title", "Add your accounts")}
      </h2>

      <p className="text-gray-600 mb-6">
        {t(
          "assets.description",
          "Add bank accounts and property to track your complete wealth. This step is optional - you can add these later.",
        )}
      </p>

      {/* Bank Accounts Section */}
      <div className="mb-8">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
          <i className="fas fa-university text-blue-500 mr-2"></i>
          {t("assets.bankAccounts", "Bank Accounts")}
        </h3>

        {/* Existing accounts */}
        {bankAccounts.length > 0 && (
          <div className="space-y-2 mb-4">
            {bankAccounts.map((account, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
              >
                <div>
                  <span className="font-medium">{account.name}</span>
                  <span className="text-gray-500 ml-2">
                    ({account.currency})
                  </span>
                  {account.balance && (
                    <span className="text-gray-600 ml-2">
                      - {account.balance.toLocaleString()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeBankAccount(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new account form */}
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5">
            <input
              type="text"
              value={newAccount.name}
              onChange={(e) =>
                setNewAccount({ ...newAccount, name: e.target.value })
              }
              placeholder={t("assets.accountName", "Account name")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-2">
            <select
              value={newAccount.currency}
              onChange={(e) =>
                setNewAccount({ ...newAccount, currency: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <input
              type="number"
              value={newAccount.balance || ""}
              onChange={(e) =>
                setNewAccount({
                  ...newAccount,
                  balance: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={t("assets.balance", "Balance")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-2">
            <button
              type="button"
              onClick={addBankAccount}
              disabled={!newAccount.name.trim()}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                newAccount.name.trim()
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Property Section */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3 flex items-center">
          <i className="fas fa-home text-green-500 mr-2"></i>
          {t("assets.property", "Property")}
        </h3>

        {/* Existing properties */}
        {properties.length > 0 && (
          <div className="space-y-2 mb-4">
            {properties.map((property, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
              >
                <div>
                  <span className="font-medium">{property.name}</span>
                  <span className="text-gray-600 ml-2">
                    - {baseCurrency}{" "}
                    {(property.value || property.price).toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeProperty(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new property form */}
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5">
            <input
              type="text"
              value={newProperty.name}
              onChange={(e) =>
                setNewProperty({ ...newProperty, name: e.target.value })
              }
              placeholder={t("assets.propertyName", "Property name")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-3">
            <input
              type="number"
              value={newProperty.price || ""}
              onChange={(e) =>
                setNewProperty({
                  ...newProperty,
                  price: Number(e.target.value) || 0,
                })
              }
              placeholder={t("assets.purchasePrice", "Purchase price")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-2">
            <input
              type="number"
              value={newProperty.value || ""}
              onChange={(e) =>
                setNewProperty({
                  ...newProperty,
                  value: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={t("assets.currentValue", "Current")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-2">
            <button
              type="button"
              onClick={addProperty}
              disabled={!newProperty.name.trim() || newProperty.price <= 0}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                newProperty.name.trim() && newProperty.price > 0
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {t(
            "assets.propertyHint",
            "Leave current value blank to use purchase price",
          )}
        </p>
      </div>
    </div>
  )
}

export default AssetsStep
