import React, { useState, useEffect, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useUser } from "@auth0/nextjs-auth0/client"
import Image from "next/image"
import Link from "next/link"
import { rootLoader } from "@components/ui/PageLoader"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import {
  Currency,
  GroupByApiValue,
  HoldingsView,
  Market,
  RegistrationResponse,
  TaxRate,
  UserPreferencesRequest,
} from "types/beancounter"
import {
  GROUP_BY_API_VALUES,
  VALUE_IN_OPTIONS,
  ValueInOption,
} from "types/constants"
import { useIsAdmin } from "@hooks/useIsAdmin"

type SettingsTab = "profile" | "wealth" | "tax" | "account"

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: "profile", label: "Profile", icon: "fa-user" },
  { id: "wealth", label: "Wealth", icon: "fa-chart-pie" },
  { id: "tax", label: "Tax", icon: "fa-percent" },
  { id: "account", label: "Account", icon: "fa-cog" },
]

// Common country codes for tax rate configuration
const COUNTRY_OPTIONS = [
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
]

const SETTINGS_LABELS: Record<string, string> = {
  "settings.holdingsView.summary": "Summary",
  "settings.holdingsView.cards": "Cards",
  "settings.holdingsView.heatmap": "Heatmap",
  "settings.holdingsView.table": "Table",
  "settings.holdingsView.allocation": "Allocation",
  "settings.valueIn.portfolio": "Portfolio Currency",
  "settings.valueIn.base": "Base Currency",
  "settings.valueIn.trade": "Trade Currency",
  "settings.groupBy.class": "Asset Class",
  "settings.groupBy.sector": "Sector",
  "settings.groupBy.currency": "Currency",
  "settings.groupBy.market": "Market",
}

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
  const { user } = useUser()
  const { refetch: refetchPreferences } = useUserPreferences()
  const { isAdmin } = useIsAdmin()
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
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
  const [enableTwr, setEnableTwr] = useState<boolean>(false)
  const [defaultMarket, setDefaultMarket] = useState<string>("US")

  // Fetch current preferences, currencies, and tax rates
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [
          meResponse,
          currenciesResponse,
          taxRatesResponse,
          marketsResponse,
        ] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/currencies"),
          fetch("/api/tax-rates"),
          fetch("/api/markets"),
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
            setEnableTwr(meData.preferences.enableTwr ?? false)
            setDefaultMarket(meData.preferences.defaultMarket || "US")
          }
        }

        if (currenciesResponse.ok) {
          const currenciesData = await currenciesResponse.json()
          if (currenciesData.data) {
            setCurrencies(currenciesData.data)
          }
        }

        if (marketsResponse.ok) {
          const marketsData = await marketsResponse.json()
          if (marketsData.data) {
            setMarkets(marketsData.data)
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
        setError("Failed to load settings")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

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
        enableTwr,
        defaultMarket,
      }

      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      if (response.ok) {
        await refetchPreferences()
        setSuccess("Settings saved successfully")
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || "Failed to save settings")
      }
    } catch (err) {
      console.error("Failed to save settings:", err)
      setError("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTaxRate = useCallback(async (): Promise<void> => {
    if (!newTaxCountry || !newTaxRate) return

    const rate = parseFloat(newTaxRate) / 100
    if (isNaN(rate) || rate < 0 || rate > 1) {
      setError("Rate must be between 0 and 100%")
      return
    }

    setTaxRateSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/tax-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode: newTaxCountry, rate }),
      })

      if (response.ok) {
        const data = await response.json()
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
        setSuccess("Tax rate saved")
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || "Failed to save tax rate")
      }
    } catch (err) {
      console.error("Failed to save tax rate:", err)
      setError("Failed to save tax rate")
    } finally {
      setTaxRateSaving(false)
    }
  }, [newTaxCountry, newTaxRate])

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
          setSuccess("Tax rate deleted")
          setTimeout(() => setSuccess(null), 3000)
        } else {
          setError("Failed to delete tax rate")
        }
      } catch (err) {
        console.error("Failed to delete tax rate:", err)
        setError("Failed to delete tax rate")
      }
    },
    [],
  )

  const getCountryName = useCallback((code: string): string => {
    const country = COUNTRY_OPTIONS.find((c) => c.code === code)
    return country ? country.name : code
  }, [])

  const availableCountries = COUNTRY_OPTIONS.filter(
    (c) => !taxRates.some((r) => r.countryCode === c.code),
  )

  if (isLoading) {
    return rootLoader("Loading...")
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{"Settings"}</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <i className={`fas ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error/Success Messages */}
      {error && <Alert className="mb-4">{error}</Alert>}
      {success && (
        <Alert variant="success" className="mb-4">
          {success}
        </Alert>
      )}

      {/* Profile Tab */}
      {activeTab === "profile" && user && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-4 mb-6">
            <Image
              src={user.picture as string}
              alt={user.name as string}
              width={64}
              height={64}
              className="rounded-full"
            />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {user.name || user.nickname}
              </h2>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Preferred Name */}
            <div>
              <label
                htmlFor="preferredName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Preferred Name"}
              </label>
              <input
                id="preferredName"
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder={"Enter your preferred name"}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {"How you'd like to be greeted in the app"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">
                Nickname
              </label>
              <p className="mt-1 text-gray-900">{user.nickname || "-"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">
                Email
              </label>
              <p className="mt-1 text-gray-900">{user.email}</p>
            </div>
            {user.email_verified !== undefined && (
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  Email Verified
                </label>
                <p className="mt-1">
                  {user.email_verified ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <i className="fas fa-check-circle"></i> Verified
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1">
                      <i className="fas fa-exclamation-circle"></i> Not verified
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wealth Tab */}
      {activeTab === "wealth" && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            {/* Default Holdings View */}
            <div>
              <label
                htmlFor="holdingsView"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Default Holdings View"}
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
                    {SETTINGS_LABELS[option.labelKey] ?? option.labelKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Value In */}
            <div>
              <label
                htmlFor="valueIn"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Default Value Currency"}
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
                    {SETTINGS_LABELS[option.labelKey] ?? option.labelKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Group By */}
            <div>
              <label
                htmlFor="groupBy"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Default Grouping"}
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
                    {SETTINGS_LABELS[option.labelKey] ?? option.labelKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Market */}
            <div>
              <label
                htmlFor="defaultMarket"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Default Market"}
              </label>
              <select
                id="defaultMarket"
                value={defaultMarket}
                onChange={(e) => setDefaultMarket(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
              >
                {markets.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {
                  "Used as the default market when searching for assets and entering trades"
                }
              </p>
            </div>

            {/* System Base Currency */}
            <div>
              <label
                htmlFor="baseCurrency"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"System Base Currency"}
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
            </div>

            {/* Reporting Currency */}
            <div>
              <label
                htmlFor="reportingCurrency"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Reporting Currency"}
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
            </div>

            {/* Show Weighted IRR */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {"Show Weighted IRR"}
                </label>
                <p className="text-sm text-gray-500">
                  {"Display market-value weighted IRR in group subtotals"}
                </p>
              </div>
              <button
                type="button"
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

            {/* Enable TWR — admin only */}
            {isAdmin && (
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {"Wealth Performance Chart"}
                  </label>
                  <p className="text-sm text-gray-500">
                    {"Show time-weighted return chart on the wealth page"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableTwr}
                  onClick={() => setEnableTwr(!enableTwr)}
                  className={`${
                    enableTwr ? "bg-blue-600" : "bg-gray-200"
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      enableTwr ? "translate-x-5" : "translate-x-0"
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Tab */}
      {activeTab === "tax" && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {"Income Tax Rates"}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {"Configure tax rates by country for rental income calculations"}
          </p>

          <div className="space-y-4">
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
                        onClick={() => handleDeleteTaxRate(rate.countryCode)}
                        className="text-red-600 hover:text-red-800"
                        title={"Delete"}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Tax Rate */}
            <div className="flex items-end gap-3 pt-4 border-t">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Country"}
                </label>
                <select
                  value={newTaxCountry}
                  onChange={(e) => setNewTaxCountry(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{"Select country..."}</option>
                  {availableCountries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.code} - {country.name}
                    </option>
                  ))}
                  {taxRates.map((rate) => (
                    <option key={rate.countryCode} value={rate.countryCode}>
                      {rate.countryCode} - {getCountryName(rate.countryCode)}{" "}
                      (update)
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Rate (%)"}
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
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {taxRateSaving ? <Spinner /> : "Add"}
              </button>
            </div>

            {taxRates.length === 0 && (
              <p className="text-sm text-gray-500 italic">
                {
                  "No tax rates configured. Add a rate to deduct income tax from rental properties."
                }
              </p>
            )}
          </div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* Danger Zone */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium text-red-600 mb-4 flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i>
              Danger Zone
            </h3>
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Close Account</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Export your data and permanently delete your account
                  </p>
                </div>
                <Link
                  href="/offboarding"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2"
                >
                  <i className="fas fa-user-minus"></i>
                  Close Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withPageAuthRequired(SettingsPage)
