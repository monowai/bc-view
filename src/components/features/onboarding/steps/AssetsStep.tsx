import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { BankAccount, Property, Pension, Insurance } from "../OnboardingWizard"
import MathInput from "@components/ui/MathInput"
import { PolicyType, SubAccountRequest } from "types/beancounter"
import CompositeAssetEditor from "@components/features/assets/CompositeAssetEditor"

type AssetType = "bank" | "property" | "pension" | "insurance" | null

interface AssetsStepProps {
  baseCurrency: string
  bankAccounts: BankAccount[]
  properties: Property[]
  pensions: Pension[]
  insurances: Insurance[]
  onBankAccountsChange: (accounts: BankAccount[]) => void
  onPropertiesChange: (properties: Property[]) => void
  onPensionsChange: (pensions: Pension[]) => void
  onInsurancesChange: (insurances: Insurance[]) => void
}

const CURRENCIES = ["NZD", "USD", "AUD", "GBP", "EUR", "SGD", "CAD", "JPY"]

const AssetsStep: React.FC<AssetsStepProps> = ({
  baseCurrency,
  bankAccounts,
  properties,
  pensions,
  insurances,
  onBankAccountsChange,
  onPropertiesChange,
  onPensionsChange,
  onInsurancesChange,
}) => {
  const { t } = useTranslation("onboarding")
  const [selectedType, setSelectedType] = useState<AssetType>(null)

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
    purchaseDate: undefined,
  })
  const [newPension, setNewPension] = useState<Pension>({
    name: "",
    currency: baseCurrency,
    balance: undefined,
    expectedReturnRate: 0.05,
    payoutAge: undefined,
    monthlyPayoutAmount: undefined,
    lumpSum: false,
    monthlyContribution: undefined,
    policyType: undefined,
    lockedUntilDate: "",
    subAccounts: [],
  })
  const [newInsurance, setNewInsurance] = useState<Insurance>({
    name: "",
    currency: baseCurrency,
    currentValue: undefined,
    expectedReturnRate: 0.03,
    payoutAge: undefined,
    payoutAmount: undefined,
    lumpSum: true, // Default to lump sum for life insurance
    monthlyContribution: undefined,
  })

  const resetForms = (): void => {
    setNewAccount({ name: "", currency: baseCurrency, balance: undefined })
    setNewProperty({
      name: "",
      price: 0,
      value: undefined,
      purchaseDate: undefined,
    })
    setNewPension({
      name: "",
      currency: baseCurrency,
      balance: undefined,
      expectedReturnRate: 0.05,
      payoutAge: undefined,
      monthlyPayoutAmount: undefined,
      lumpSum: false,
      monthlyContribution: undefined,
      policyType: undefined,
      lockedUntilDate: "",
      subAccounts: [],
    })
    setNewInsurance({
      name: "",
      currency: baseCurrency,
      currentValue: undefined,
      expectedReturnRate: 0.03,
      payoutAge: undefined,
      payoutAmount: undefined,
      lumpSum: true,
      monthlyContribution: undefined,
    })
  }

  const addBankAccount = (): void => {
    if (newAccount.name.trim()) {
      onBankAccountsChange([...bankAccounts, { ...newAccount }])
      resetForms()
      setSelectedType(null)
    }
  }

  const removeBankAccount = (index: number): void => {
    onBankAccountsChange(bankAccounts.filter((_, i) => i !== index))
  }

  const addProperty = (): void => {
    if (newProperty.name.trim() && newProperty.price > 0) {
      onPropertiesChange([...properties, { ...newProperty }])
      resetForms()
      setSelectedType(null)
    }
  }

  const removeProperty = (index: number): void => {
    onPropertiesChange(properties.filter((_, i) => i !== index))
  }

  const addPension = (): void => {
    if (newPension.name.trim()) {
      onPensionsChange([...pensions, { ...newPension }])
      resetForms()
      setSelectedType(null)
    }
  }

  const removePension = (index: number): void => {
    onPensionsChange(pensions.filter((_, i) => i !== index))
  }

  const addInsurance = (): void => {
    if (newInsurance.name.trim()) {
      onInsurancesChange([...insurances, { ...newInsurance }])
      resetForms()
      setSelectedType(null)
    }
  }

  const removeInsurance = (index: number): void => {
    onInsurancesChange(insurances.filter((_, i) => i !== index))
  }

  const totalAssets =
    bankAccounts.length +
    properties.length +
    pensions.length +
    insurances.length

  // Asset type cards configuration
  const assetTypes = [
    {
      id: "bank" as AssetType,
      icon: "fa-university",
      color: "blue",
      title: t("assets.type.bank", "Bank Account"),
      description: t(
        "assets.type.bank.desc",
        "Track savings, checking, or fixed deposit accounts. Great for emergency funds and liquid savings.",
      ),
    },
    {
      id: "pension" as AssetType,
      icon: "fa-piggy-bank",
      color: "purple",
      title: t("assets.type.pension", "Pension Plan"),
      description: t(
        "assets.type.pension.desc",
        "Workplace pensions, 401k, or retirement funds. Set payout age and expected income for retirement planning.",
      ),
    },
    {
      id: "insurance" as AssetType,
      icon: "fa-shield-alt",
      color: "teal",
      title: t("assets.type.insurance", "Life Insurance"),
      description: t(
        "assets.type.insurance.desc",
        "Life insurance policies with cash value or payout amounts. Track for estate planning and financial independence.",
      ),
    },
    {
      id: "property" as AssetType,
      icon: "fa-home",
      color: "green",
      title: t("assets.type.property", "Property"),
      description: t(
        "assets.type.property.desc",
        "Add real estate like your home or investment properties. Track value appreciation over time.",
      ),
    },
  ]

  const getColorClasses = (color: string, isSelected: boolean): string => {
    const colors: Record<
      string,
      { bg: string; border: string; text: string; hover: string }
    > = {
      blue: {
        bg: isSelected ? "bg-blue-50" : "bg-white",
        border: isSelected ? "border-blue-500" : "border-gray-200",
        text: "text-blue-500",
        hover: "hover:border-blue-300",
      },
      green: {
        bg: isSelected ? "bg-green-50" : "bg-white",
        border: isSelected ? "border-green-500" : "border-gray-200",
        text: "text-green-500",
        hover: "hover:border-green-300",
      },
      purple: {
        bg: isSelected ? "bg-purple-50" : "bg-white",
        border: isSelected ? "border-purple-500" : "border-gray-200",
        text: "text-purple-500",
        hover: "hover:border-purple-300",
      },
      teal: {
        bg: isSelected ? "bg-teal-50" : "bg-white",
        border: isSelected ? "border-teal-500" : "border-gray-200",
        text: "text-teal-500",
        hover: "hover:border-teal-300",
      },
    }
    return `${colors[color].bg} ${colors[color].border} ${colors[color].hover}`
  }

  const getIconColor = (color: string): string => {
    const colors: Record<string, string> = {
      blue: "text-blue-500",
      green: "text-green-500",
      purple: "text-purple-500",
      teal: "text-teal-500",
    }
    return colors[color]
  }

  return (
    <div className="py-4">
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {t("assets.title", "Add your assets")}
      </h2>

      <p className="text-gray-600 mb-6">
        {t(
          "assets.description",
          "Tell us about your assets to get a complete picture of your wealth. This step is optional.",
        )}
      </p>

      {/* Added Assets Summary */}
      {totalAssets > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-700 mb-3">
            {t("assets.added", "Assets added")}
          </h3>
          <div className="space-y-2">
            {bankAccounts.map((account, index) => (
              <div
                key={`bank-${index}`}
                className="flex items-center justify-between bg-white rounded p-2 border border-gray-200"
              >
                <div className="flex items-center">
                  <i className="fas fa-university text-blue-500 w-6"></i>
                  <span className="font-medium">{account.name}</span>
                  <span className="text-gray-500 ml-2">
                    ({account.currency})
                  </span>
                  {account.balance && (
                    <span className="text-gray-600 ml-2">
                      {account.balance.toLocaleString()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeBankAccount(index)}
                  className="text-red-500 hover:text-red-700 px-2"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            {properties.map((property, index) => (
              <div
                key={`prop-${index}`}
                className="flex items-center justify-between bg-white rounded p-2 border border-gray-200"
              >
                <div className="flex items-center">
                  <i className="fas fa-home text-green-500 w-6"></i>
                  <span className="font-medium">{property.name}</span>
                  <span className="text-gray-600 ml-2">
                    {baseCurrency}{" "}
                    {(property.value || property.price).toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeProperty(index)}
                  className="text-red-500 hover:text-red-700 px-2"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            {pensions.map((pension, index) => (
              <div
                key={`pension-${index}`}
                className="flex items-center justify-between bg-white rounded p-2 border border-gray-200"
              >
                <div className="flex items-center">
                  <i className="fas fa-piggy-bank text-purple-500 w-6"></i>
                  <span className="font-medium">{pension.name}</span>
                  <span className="text-gray-500 ml-2">
                    ({pension.currency})
                  </span>
                  {pension.balance && (
                    <span className="text-gray-600 ml-2">
                      {pension.balance.toLocaleString()}
                    </span>
                  )}
                  {pension.policyType && (
                    <span className="text-purple-600 ml-2 text-sm">
                      [{pension.policyType}]
                    </span>
                  )}
                  {pension.payoutAge && (
                    <span className="text-purple-600 ml-2 text-sm">
                      @ age {pension.payoutAge}
                      {pension.lumpSum && " (lump sum)"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removePension(index)}
                  className="text-red-500 hover:text-red-700 px-2"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            {insurances.map((insurance, index) => (
              <div
                key={`insurance-${index}`}
                className="flex items-center justify-between bg-white rounded p-2 border border-gray-200"
              >
                <div className="flex items-center">
                  <i className="fas fa-shield-alt text-teal-500 w-6"></i>
                  <span className="font-medium">{insurance.name}</span>
                  <span className="text-gray-500 ml-2">
                    ({insurance.currency})
                  </span>
                  {insurance.currentValue && (
                    <span className="text-gray-600 ml-2">
                      {insurance.currentValue.toLocaleString()}
                    </span>
                  )}
                  {insurance.payoutAge && (
                    <span className="text-teal-600 ml-2 text-sm">
                      @ age {insurance.payoutAge}
                      {insurance.lumpSum && " (lump sum)"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeInsurance(index)}
                  className="text-red-500 hover:text-red-700 px-2"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asset Type Selection */}
      {!selectedType && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-700">
            {totalAssets > 0
              ? t("assets.addAnother", "Add another asset")
              : t("assets.chooseType", "Choose an asset type to add")}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {assetTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${getColorClasses(type.color, false)}`}
              >
                <div className="flex items-start">
                  <div className={`text-2xl mr-4 ${getIconColor(type.color)}`}>
                    <i className={`fas ${type.icon}`}></i>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{type.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {type.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bank Account Form */}
      {selectedType === "bank" && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center mb-4">
            <i className="fas fa-university text-blue-500 text-xl mr-3"></i>
            <h3 className="font-medium text-gray-900">
              {t("assets.form.bank.title", "Add Bank Account")}
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("assets.form.name", "Account Name")}
              </label>
              <input
                type="text"
                value={newAccount.name}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, name: e.target.value })
                }
                placeholder={t(
                  "assets.form.bank.namePlaceholder",
                  "e.g., Main Savings, Emergency Fund",
                )}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.currency", "Currency")}
                </label>
                <select
                  value={newAccount.currency}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, currency: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.balance", "Current Balance")}
                </label>
                <MathInput
                  value={newAccount.balance}
                  onChange={(value) =>
                    setNewAccount({
                      ...newAccount,
                      balance: value || undefined,
                    })
                  }
                  placeholder={t("assets.form.optional", "Optional")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForms()
                  setSelectedType(null)
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={addBankAccount}
                disabled={!newAccount.name.trim()}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  newAccount.name.trim()
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {t("assets.form.save", "Save Account")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Form */}
      {selectedType === "property" && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center mb-4">
            <i className="fas fa-home text-green-500 text-xl mr-3"></i>
            <h3 className="font-medium text-gray-900">
              {t("assets.form.property.title", "Add Property")}
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("assets.form.name", "Property Name")}
              </label>
              <input
                type="text"
                value={newProperty.name}
                onChange={(e) =>
                  setNewProperty({ ...newProperty, name: e.target.value })
                }
                placeholder={t(
                  "assets.form.property.namePlaceholder",
                  "e.g., Main Residence, Beach House",
                )}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.property.purchaseDate", "Purchase Date")}
                </label>
                <input
                  type="date"
                  value={newProperty.purchaseDate || ""}
                  onChange={(e) =>
                    setNewProperty({
                      ...newProperty,
                      purchaseDate: e.target.value || undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.property.purchasePrice", "Purchase Price")} (
                  {baseCurrency})
                </label>
                <MathInput
                  value={newProperty.price}
                  onChange={(value) =>
                    setNewProperty({
                      ...newProperty,
                      price: value || 0,
                    })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("assets.form.property.currentValue", "Current Value")} (
                {baseCurrency})
              </label>
              <MathInput
                value={newProperty.value}
                onChange={(value) =>
                  setNewProperty({
                    ...newProperty,
                    value: value || undefined,
                  })
                }
                placeholder={t(
                  "assets.form.property.sameAsPrice",
                  "Same as purchase",
                )}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t(
                  "assets.form.property.currentValueHint",
                  "Leave blank if same as purchase price",
                )}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForms()
                  setSelectedType(null)
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={addProperty}
                disabled={!newProperty.name.trim() || newProperty.price <= 0}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  newProperty.name.trim() && newProperty.price > 0
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {t("assets.form.saveProperty", "Save Property")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pension Form */}
      {selectedType === "pension" && (
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center mb-4">
            <i className="fas fa-piggy-bank text-purple-500 text-xl mr-3"></i>
            <h3 className="font-medium text-gray-900">
              {t("assets.form.pension.title", "Add Pension Plan")}
            </h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.name", "Pension Name")}
                </label>
                <input
                  type="text"
                  value={newPension.name}
                  onChange={(e) =>
                    setNewPension({ ...newPension, name: e.target.value })
                  }
                  placeholder={t(
                    "assets.form.pension.namePlaceholder",
                    "e.g., Company 401k, KiwiSaver",
                  )}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.currency", "Currency")}
                </label>
                <select
                  value={newPension.currency}
                  onChange={(e) =>
                    setNewPension({ ...newPension, currency: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.pension.balance", "Current Balance")}
                </label>
                <MathInput
                  value={newPension.balance}
                  onChange={(value) =>
                    setNewPension({
                      ...newPension,
                      balance: value || undefined,
                    })
                  }
                  placeholder={t("assets.form.optional", "Optional")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.pension.returnRate", "Expected Return %")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={
                    newPension.expectedReturnRate
                      ? (newPension.expectedReturnRate * 100).toFixed(1)
                      : ""
                  }
                  onChange={(e) =>
                    setNewPension({
                      ...newPension,
                      expectedReturnRate: e.target.value
                        ? Number(e.target.value) / 100
                        : undefined,
                    })
                  }
                  placeholder="5.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Monthly Contribution */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <i className="fas fa-calendar-alt text-purple-500 mr-2"></i>
                {t("assets.form.pension.contribution", "Monthly Contribution")}
              </label>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">
                  {newPension.currency}
                </span>
                <MathInput
                  value={newPension.monthlyContribution}
                  onChange={(value) =>
                    setNewPension({
                      ...newPension,
                      monthlyContribution: value || undefined,
                    })
                  }
                  placeholder="0"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="text-gray-500 ml-2">/month</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t(
                  "assets.form.pension.contributionHint",
                  "Supports expressions: 12h/12 = 100, 1k*12 = 12000",
                )}
              </p>
            </div>

            {/* Composite Policy Type */}
            <CompositeAssetEditor
              policyType={newPension.policyType}
              lockedUntilDate={newPension.lockedUntilDate || ""}
              subAccounts={newPension.subAccounts || []}
              onPolicyTypeChange={(value: PolicyType | undefined) =>
                setNewPension({ ...newPension, policyType: value })
              }
              onLockedUntilDateChange={(value: string) =>
                setNewPension({ ...newPension, lockedUntilDate: value })
              }
              onSubAccountsChange={(accounts: SubAccountRequest[]) =>
                setNewPension({ ...newPension, subAccounts: accounts })
              }
            />

            {/* Lump Sum Toggle */}
            <div className="flex items-center p-3 bg-purple-100 rounded-lg">
              <input
                type="checkbox"
                id="pension-lump-sum"
                checked={newPension.lumpSum || false}
                onChange={(e) =>
                  setNewPension({
                    ...newPension,
                    lumpSum: e.target.checked,
                    // Clear monthly payout if switching to lump sum
                    monthlyPayoutAmount: e.target.checked
                      ? undefined
                      : newPension.monthlyPayoutAmount,
                  })
                }
                className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label
                htmlFor="pension-lump-sum"
                className="ml-3 text-sm text-gray-700"
              >
                {t(
                  "assets.form.pension.lumpSum",
                  "Pays out in full (lump sum) rather than monthly",
                )}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.pension.payoutAge", "Payout Age")}
                </label>
                <input
                  type="number"
                  value={newPension.payoutAge || ""}
                  onChange={(e) =>
                    setNewPension({
                      ...newPension,
                      payoutAge: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder={t(
                    "assets.form.pension.payoutAgePlaceholder",
                    "e.g., 65",
                  )}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t(
                    "assets.form.pension.payoutAgeHint",
                    "Age when you can start withdrawing",
                  )}
                </p>
              </div>
              {!newPension.lumpSum && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("assets.form.pension.monthlyPayout", "Monthly Payout")}
                  </label>
                  <MathInput
                    value={newPension.monthlyPayoutAmount}
                    onChange={(value) =>
                      setNewPension({
                        ...newPension,
                        monthlyPayoutAmount: value || undefined,
                      })
                    }
                    placeholder={t("assets.form.optional", "Optional")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      "assets.form.pension.monthlyPayoutHint",
                      "Expected monthly income at payout age",
                    )}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForms()
                  setSelectedType(null)
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={addPension}
                disabled={!newPension.name.trim()}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  newPension.name.trim()
                    ? "bg-purple-500 hover:bg-purple-600"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {t("assets.form.savePension", "Save Pension")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insurance Form */}
      {selectedType === "insurance" && (
        <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
          <div className="flex items-center mb-4">
            <i className="fas fa-shield-alt text-teal-500 text-xl mr-3"></i>
            <h3 className="font-medium text-gray-900">
              {t("assets.form.insurance.title", "Add Life Insurance")}
            </h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.name", "Policy Name")}
                </label>
                <input
                  type="text"
                  value={newInsurance.name}
                  onChange={(e) =>
                    setNewInsurance({ ...newInsurance, name: e.target.value })
                  }
                  placeholder={t(
                    "assets.form.insurance.namePlaceholder",
                    "e.g., Term Life, Whole Life",
                  )}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.currency", "Currency")}
                </label>
                <select
                  value={newInsurance.currency}
                  onChange={(e) =>
                    setNewInsurance({
                      ...newInsurance,
                      currency: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t(
                    "assets.form.insurance.currentValue",
                    "Current Cash Value",
                  )}
                </label>
                <MathInput
                  value={newInsurance.currentValue}
                  onChange={(value) =>
                    setNewInsurance({
                      ...newInsurance,
                      currentValue: value || undefined,
                    })
                  }
                  placeholder={t("assets.form.optional", "Optional")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t(
                    "assets.form.insurance.currentValueHint",
                    "Cash surrender value if applicable",
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("assets.form.insurance.returnRate", "Growth Rate %")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={
                    newInsurance.expectedReturnRate
                      ? (newInsurance.expectedReturnRate * 100).toFixed(1)
                      : ""
                  }
                  onChange={(e) =>
                    setNewInsurance({
                      ...newInsurance,
                      expectedReturnRate: e.target.value
                        ? Number(e.target.value) / 100
                        : undefined,
                    })
                  }
                  placeholder="3.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t(
                    "assets.form.insurance.returnRateHint",
                    "Used to project payout value at maturity",
                  )}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("assets.form.insurance.payoutAge", "Maturity Age")}
              </label>
              <input
                type="number"
                value={newInsurance.payoutAge || ""}
                onChange={(e) =>
                  setNewInsurance({
                    ...newInsurance,
                    payoutAge: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder={t("assets.form.optional", "Optional")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t(
                  "assets.form.insurance.payoutAgeHint",
                  "Age when policy matures and pays out",
                )}
              </p>
            </div>

            {/* Payout Type Selection */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t(
                  "assets.form.insurance.payoutType",
                  "How does this policy pay out?",
                )}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="insurance-payout-type"
                    checked={newInsurance.lumpSum === true}
                    onChange={() =>
                      setNewInsurance({
                        ...newInsurance,
                        lumpSum: true,
                        payoutAmount: undefined,
                      })
                    }
                    className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t(
                      "assets.form.insurance.lumpSumOption",
                      "Lump sum at maturity",
                    )}
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="insurance-payout-type"
                    checked={newInsurance.lumpSum === false}
                    onChange={() =>
                      setNewInsurance({
                        ...newInsurance,
                        lumpSum: false,
                      })
                    }
                    className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t(
                      "assets.form.insurance.monthlyOption",
                      "Monthly payments",
                    )}
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {newInsurance.lumpSum
                  ? t(
                      "assets.form.insurance.lumpSumHint",
                      "Payout will be calculated based on current value and growth rate at maturity age.",
                    )
                  : t(
                      "assets.form.insurance.monthlyHint",
                      "Enter the expected monthly payment amount below.",
                    )}
              </p>
            </div>

            {/* Monthly Payout Amount - only shown when monthly is selected */}
            {!newInsurance.lumpSum && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t(
                    "assets.form.insurance.monthlyPayout",
                    "Monthly Payout Amount",
                  )}
                </label>
                <MathInput
                  value={newInsurance.payoutAmount}
                  onChange={(value) =>
                    setNewInsurance({
                      ...newInsurance,
                      payoutAmount: value || undefined,
                    })
                  }
                  placeholder={t("assets.form.optional", "Optional")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t(
                    "assets.form.insurance.monthlyPayoutHint",
                    "Expected monthly income from this policy",
                  )}
                </p>
              </div>
            )}

            {/* Monthly Premium/Contribution */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <i className="fas fa-calendar-alt text-teal-500 mr-2"></i>
                {t("assets.form.insurance.contribution", "Monthly Premium")}
              </label>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">
                  {newInsurance.currency}
                </span>
                <MathInput
                  value={newInsurance.monthlyContribution}
                  onChange={(value) =>
                    setNewInsurance({
                      ...newInsurance,
                      monthlyContribution: value || undefined,
                    })
                  }
                  placeholder="0"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="text-gray-500 ml-2">/month</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t(
                  "assets.form.insurance.contributionHint",
                  "Supports expressions: 12h/12 = 100, 1k*12 = 12000",
                )}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForms()
                  setSelectedType(null)
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={addInsurance}
                disabled={!newInsurance.name.trim()}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  newInsurance.name.trim()
                    ? "bg-teal-500 hover:bg-teal-600"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {t("assets.form.saveInsurance", "Save Insurance")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetsStep
