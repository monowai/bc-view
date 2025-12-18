import React, { useState, useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { rootLoader } from "@components/ui/PageLoader"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import {
  Currency,
  HoldingsView,
  RegistrationResponse,
  UserPreferencesRequest,
} from "types/beancounter"

const HOLDINGS_VIEW_OPTIONS: { value: HoldingsView; labelKey: string }[] = [
  { value: "SUMMARY", labelKey: "settings.holdingsView.summary" },
  { value: "TABLE", labelKey: "settings.holdingsView.table" },
  { value: "HEATMAP", labelKey: "settings.holdingsView.heatmap" },
  { value: "ALLOCATION", labelKey: "settings.holdingsView.allocation" },
]

function SettingsPage(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const { refetch: refetchPreferences } = useUserPreferences()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [preferredName, setPreferredName] = useState<string>("")
  const [defaultHoldingsView, setDefaultHoldingsView] =
    useState<HoldingsView>("SUMMARY")
  const [baseCurrencyCode, setBaseCurrencyCode] = useState<string>("USD")

  // Fetch current preferences and currencies
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [meResponse, currenciesResponse] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/currencies"),
        ])

        if (meResponse.ok) {
          const meData: RegistrationResponse = await meResponse.json()
          if (meData.preferences) {
            setPreferredName(meData.preferences.preferredName || "")
            setDefaultHoldingsView(meData.preferences.defaultHoldingsView)
            setBaseCurrencyCode(meData.preferences.baseCurrencyCode)
          }
        }

        if (currenciesResponse.ok) {
          const currenciesData = await currenciesResponse.json()
          if (currenciesData.data) {
            setCurrencies(currenciesData.data)
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
        baseCurrencyCode,
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
                {HOLDINGS_VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {t("settings.defaultHoldingsView.description")}
              </p>
            </div>

            {/* Base Currency */}
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
