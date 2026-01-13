import React, { useState, useEffect, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { rootLoader } from "@components/ui/PageLoader"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import {
  Currency,
  GroupByApiValue,
  HoldingsView,
  RegistrationResponse,
  TaxRate,
  UserPreferencesRequest,
} from "types/beancounter"
import {
  GROUP_BY_API_VALUES,
  VALUE_IN_OPTIONS,
  ValueInOption,
} from "types/constants"

// Common country codes for tax rate configuration
const COUNTRY_OPTIONS = [
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
]

const HOLDINGS_VIEW_UI_OPTIONS: { value: HoldingsView; labelKey: string }[] = [
  { value: "SUMMARY", labelKey: "settings.holdingsView.summary" },
  { value: "CARDS", labelKey: "settings.holdingsView.cards" },
  { value: "HEATMAP", labelKey: "settings.holdingsView.heatmap" },
  { value: "TABLE", labelKey: "settings.holdingsView.table" },
  { value: "ALLOCATION", labelKey: "settings.holdingsView.allocation" },
]

const VALUE_IN_UI_OPTIONS: { value: ValueInOption; labelKey: string }[] = [
  { value: VALUE_IN_OPTIONS.PORTFOLIO, labelKey: "settings.valueIn.portfolio" },
  { value: VALUE_IN_OPTIONS.BASE, labelKey: "settings.valueIn.base" },
  { value: VALUE_IN_OPTIONS.TRADE, labelKey: "settings.valueIn.trade" },
]

const GROUP_BY_UI_OPTIONS: { value: GroupByApiValue; labelKey: string }[] = [
  {
    value: GROUP_BY_API_VALUES.ASSET_CLASS,
    labelKey: "settings.groupBy.class",
  },
  { value: GROUP_BY_API_VALUES.SECTOR, labelKey: "settings.groupBy.sector" },
  {
    value: GROUP_BY_API_VALUES.MARKET_CURRENCY,
    labelKey: "settings.groupBy.currency",
  },
  { value: GROUP_BY_API_VALUES.MARKET, labelKey: "settings.groupBy.market" },
]

function SettingsPage(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const { refetch: refetchPreferences } = useUserPreferences()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [showTaxRatesSection, setShowTaxRatesSection] = useState(false)
  const [newTaxCountry, setNewTaxCountry] = useState("")
  const [newTaxRate, setNewTaxRate] = useState("")
  const [taxRateSaving, setTaxRateSaving] = useState(false)
  const [preferredName, setPreferredName] = useState<string>("")
  const [defaultHoldingsView, setDefaultHoldingsView] =
    useState<HoldingsView>("SUMMARY")
  const [defaultValueIn, setDefaultValueIn] = useState<ValueInOption>(
    VALUE_IN_OPTIONS.PORTFOLIO,
  )
  const [defaultGroupBy, setDefaultGroupBy] = useState<GroupByApiValue>(
    GROUP_BY_API_VALUES.ASSET_CLASS,
  )
  const [baseCurrencyCode, setBaseCurrencyCode] = useState<string>("USD")
  const [reportingCurrencyCode, setReportingCurrencyCode] =
    useState<string>("USD")
  const [showWeightedIrr, setShowWeightedIrr] = useState<boolean>(false)

  // Fetch current preferences, currencies, and tax rates
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [meResponse, currenciesResponse, taxRatesResponse] =
          await Promise.all([
            fetch("/api/me"),
            fetch("/api/currencies"),
            fetch("/api/tax-rates"),
          ])

        if (meResponse.ok) {
          const meData: RegistrationResponse = await meResponse.json()
          if (meData.preferences) {
            setPreferredName(meData.preferences.preferredName || "")
            setDefaultHoldingsView(meData.preferences.defaultHoldingsView)
            setDefaultValueIn(
              meData.preferences.defaultValueIn || VALUE_IN_OPTIONS.PORTFOLIO,
            )
            setDefaultGroupBy(
              meData.preferences.defaultGroupBy ||
                GROUP_BY_API_VALUES.ASSET_CLASS,
            )
            setBaseCurrencyCode(meData.preferences.baseCurrencyCode)
            setReportingCurrencyCode(
              meData.preferences.reportingCurrencyCode ||
                meData.preferences.baseCurrencyCode,
            )
            setShowWeightedIrr(meData.preferences.showWeightedIrr ?? false)
          }
        }

        if (currenciesResponse.ok) {
          const currenciesData = await currenciesResponse.json()
          if (currenciesData.data) {
            setCurrencies(currenciesData.data)
          }
        }

        if (taxRatesResponse.ok) {
          const taxRatesData = await taxRatesResponse.json()
          if (taxRatesData.data) {
            setTaxRates(taxRatesData.data)
          }
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err)
        setError(t("settings.error.load"))
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [t])

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const request: UserPreferencesRequest = {
        preferredName: preferredName || undefined,
        defaultHoldingsView,
        defaultValueIn,
        defaultGroupBy,
        baseCurrencyCode,
        reportingCurrencyCode,
        showWeightedIrr,
      }

      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      if (response.ok) {
        // Refresh the cached preferences in the context
        await refetchPreferences()
        setSuccess(t("settings.success.saved"))
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || t("settings.error.save"))
      }
    } catch (err) {
      console.error("Failed to save settings:", err)
      setError(t("settings.error.save"))
    } finally {
      setIsSaving(false)
    }
  }

  // Add or update a tax rate
  const handleAddTaxRate = useCallback(async (): Promise<void> => {
    if (!newTaxCountry || !newTaxRate) return

    const rate = parseFloat(newTaxRate) / 100 // Convert percentage to decimal
    if (isNaN(rate) || rate < 0 || rate > 1) {
      setError(
        t(
          "settings.taxRates.error.invalidRate",
          "Rate must be between 0 and 100%",
        ),
      )
      return
    }

    setTaxRateSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/tax-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: newTaxCountry,
          rate,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update or add the tax rate in the list
        setTaxRates((prev) => {
          const existing = prev.findIndex(
            (r) => r.countryCode === newTaxCountry,
          )
          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = data.data
            return updated
          }
          return [...prev, data.data]
        })
        setNewTaxCountry("")
        setNewTaxRate("")
        setSuccess(t("settings.taxRates.saved", "Tax rate saved"))
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(
          errorData.message ||
            t("settings.taxRates.error.save", "Failed to save tax rate"),
        )
      }
    } catch (err) {
      console.error("Failed to save tax rate:", err)
      setError(t("settings.taxRates.error.save", "Failed to save tax rate"))
    } finally {
      setTaxRateSaving(false)
    }
  }, [newTaxCountry, newTaxRate, t])

  // Delete a tax rate
  const handleDeleteTaxRate = useCallback(
    async (countryCode: string): Promise<void> => {
      try {
        const response = await fetch(`/api/tax-rates/${countryCode}`, {
          method: "DELETE",
        })

        if (response.ok || response.status === 204) {
          setTaxRates((prev) =>
            prev.filter((r) => r.countryCode !== countryCode),
          )
          setSuccess(t("settings.taxRates.deleted", "Tax rate deleted"))
          setTimeout(() => setSuccess(null), 3000)
        } else {
          setError(
            t("settings.taxRates.error.delete", "Failed to delete tax rate"),
          )
        }
      } catch (err) {
        console.error("Failed to delete tax rate:", err)
        setError(
          t("settings.taxRates.error.delete", "Failed to delete tax rate"),
        )
      }
    },
    [t],
  )

  // Get country name from code
  const getCountryName = useCallback((code: string): string => {
    const country = COUNTRY_OPTIONS.find((c) => c.code === code)
    return country ? country.name : code
  }, [])

  // Get countries not yet configured
  const availableCountries = COUNTRY_OPTIONS.filter(
    (c) => !taxRates.some((r) => r.countryCode === c.code),
  )

  if (!ready || isLoading) {
    return rootLoader(t("loading"))
  }

  return (
    <div className="w-full py-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {t("settings.title")}
        </h1>

        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
          <div className="space-y-6">
            {/* Preferred Name */}
            <div>
              <label
                htmlFor="preferredName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("settings.preferredName")}
              </label>
              <input
                id="preferredName"
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder={t("settings.preferredName.placeholder")}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t("settings.preferredName.description")}
              </p>
            </div>

            {/* Default Holdings View */}
            <div>
              <label
                htmlFor="holdingsView"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("settings.defaultHoldingsView")}
              </label>
              <select
                id="holdingsView"
                value={defaultHoldingsView}
                onChange={(e) =>
                  setDefaultHoldingsView(e.target.value as HoldingsView)
                }
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              >
                {HOLDINGS_VIEW_UI_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {t("settings.defaultHoldingsView.description")}
              </p>
            </div>

            {/* Default Value In */}
            <div>
              <label
                htmlFor="valueIn"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("settings.defaultValueIn")}
              </label>
              <select
                id="valueIn"
                value={defaultValueIn}
                onChange={(e) =>
                  setDefaultValueIn(e.target.value as ValueInOption)
                }
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              >
                {VALUE_IN_UI_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {t("settings.defaultValueIn.description")}
              </p>
            </div>

            {/* Default Group By */}
            <div>
              <label
                htmlFor="groupBy"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("settings.defaultGroupBy")}
              </label>
              <select
                id="groupBy"
                value={defaultGroupBy}
                onChange={(e) =>
                  setDefaultGroupBy(e.target.value as GroupByApiValue)
                }
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              >
                {GROUP_BY_UI_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {t("settings.defaultGroupBy.description")}
              </p>
            </div>

            {/* System Base Currency */}
            <div>
              <label
                htmlFor="baseCurrency"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("settings.baseCurrency")}
              </label>
              <select
                id="baseCurrency"
                value={baseCurrencyCode}
                onChange={(e) => setBaseCurrencyCode(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name} ({currency.symbol})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {t("settings.baseCurrency.description")}
              </p>
            </div>

            {/* Reporting Currency */}
            <div>
              <label
                htmlFor="reportingCurrency"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("settings.reportingCurrency")}
              </label>
              <select
                id="reportingCurrency"
                value={reportingCurrencyCode}
                onChange={(e) => setReportingCurrencyCode(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name} ({currency.symbol})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {t("settings.reportingCurrency.description")}
              </p>
            </div>

            {/* Show Weighted IRR */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="showWeightedIrr"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {t("settings.showWeightedIrr")}
                  </label>
                  <div className="group relative">
                    <svg
                      className="w-4 h-4 text-gray-400 cursor-help"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                      {t("settings.showWeightedIrr.tooltip")}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  id="showWeightedIrr"
                  role="switch"
                  aria-checked={showWeightedIrr}
                  onClick={() => setShowWeightedIrr(!showWeightedIrr)}
                  className={`${
                    showWeightedIrr ? "bg-blue-600" : "bg-gray-200"
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      showWeightedIrr ? "translate-x-5" : "translate-x-0"
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {t("settings.showWeightedIrr.description")}
              </p>
            </div>

            {/* Tax Rates Section */}
            <div className="border-t pt-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowTaxRatesSection(!showTaxRatesSection)}
              >
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {t("settings.taxRates.title", "Income Tax Rates")}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t(
                      "settings.taxRates.description",
                      "Configure tax rates by country for rental income calculations",
                    )}
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transform transition-transform ${
                    showTaxRatesSection ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              {showTaxRatesSection && (
                <div className="mt-4 space-y-4">
                  {/* Existing Tax Rates */}
                  {taxRates.length > 0 && (
                    <div className="space-y-2">
                      {taxRates.map((rate) => (
                        <div
                          key={rate.countryCode}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                        >
                          <div>
                            <span className="font-medium text-gray-900">
                              {rate.countryCode}
                            </span>
                            <span className="text-gray-500 ml-2">
                              - {getCountryName(rate.countryCode)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-700 font-medium">
                              {(rate.rate * 100).toFixed(1)}%
                            </span>
                            <button
                              onClick={() =>
                                handleDeleteTaxRate(rate.countryCode)
                              }
                              className="text-red-600 hover:text-red-800"
                              title={t("delete")}
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Tax Rate */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t("settings.taxRates.country", "Country")}
                      </label>
                      <select
                        value={newTaxCountry}
                        onChange={(e) => setNewTaxCountry(e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">
                          {t(
                            "settings.taxRates.selectCountry",
                            "Select country...",
                          )}
                        </option>
                        {availableCountries.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.code} - {country.name}
                          </option>
                        ))}
                        {/* Allow updating existing rates */}
                        {taxRates.map((rate) => (
                          <option
                            key={rate.countryCode}
                            value={rate.countryCode}
                          >
                            {rate.countryCode} -{" "}
                            {getCountryName(rate.countryCode)} (update)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t("settings.taxRates.rate", "Rate (%)")}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={newTaxRate}
                        onChange={(e) => setNewTaxRate(e.target.value)}
                        placeholder="20"
                        className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleAddTaxRate}
                      disabled={!newTaxCountry || !newTaxRate || taxRateSaving}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {taxRateSaving ? (
                        <svg
                          className="animate-spin h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        t("settings.taxRates.add", "Add")
                      )}
                    </button>
                  </div>

                  {taxRates.length === 0 && (
                    <p className="text-sm text-gray-500 italic">
                      {t(
                        "settings.taxRates.empty",
                        "No tax rates configured. Add a rate to deduct income tax from rental properties.",
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? t("settings.saving") : t("settings.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default withPageAuthRequired(SettingsPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
