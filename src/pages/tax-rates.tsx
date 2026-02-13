import React, { useState, useEffect, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { rootLoader } from "@components/ui/PageLoader"
import Alert from "@components/ui/Alert"
import { TaxRate } from "types/beancounter"

// Common country codes for tax rate configuration
const COUNTRY_OPTIONS = [
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
]

function TaxRatesPage(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [newTaxCountry, setNewTaxCountry] = useState("")
  const [newTaxRate, setNewTaxRate] = useState("")
  const [taxRateSaving, setTaxRateSaving] = useState(false)

  // Fetch tax rates on mount
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const response = await fetch("/api/tax-rates")
        if (response.ok) {
          const data = await response.json()
          if (data.data) {
            setTaxRates(data.data)
          }
        }
      } catch (err) {
        console.error("Failed to fetch tax rates:", err)
        setError(t("taxRates.error.load", "Failed to load tax rates"))
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [t])

  // Add or update a tax rate
  const handleAddTaxRate = useCallback(async (): Promise<void> => {
    if (!newTaxCountry || !newTaxRate) return

    const rate = parseFloat(newTaxRate) / 100 // Convert percentage to decimal
    if (isNaN(rate) || rate < 0 || rate > 1) {
      setError(
        t("taxRates.error.invalidRate", "Rate must be between 0 and 100%"),
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
        setSuccess(t("taxRates.saved", "Tax rate saved"))
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(
          errorData.message ||
            t("taxRates.error.save", "Failed to save tax rate"),
        )
      }
    } catch (err) {
      console.error("Failed to save tax rate:", err)
      setError(t("taxRates.error.save", "Failed to save tax rate"))
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
          setSuccess(t("taxRates.deleted", "Tax rate deleted"))
          setTimeout(() => setSuccess(null), 3000)
        } else {
          setError(t("taxRates.error.delete", "Failed to delete tax rate"))
        }
      } catch (err) {
        console.error("Failed to delete tax rate:", err)
        setError(t("taxRates.error.delete", "Failed to delete tax rate"))
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-percent text-blue-600"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("taxRates.title", "Income Tax Rates")}
            </h1>
            <p className="text-sm text-gray-500">
              {t(
                "taxRates.subtitle",
                "Configure tax rates by country for rental income calculations",
              )}
            </p>
          </div>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
          <div className="space-y-6">
            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <i className="fas fa-info-circle text-blue-500 mt-0.5 mr-3"></i>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">
                    {t("taxRates.info.title", "How tax rates work")}
                  </p>
                  <p>
                    {t(
                      "taxRates.info.description",
                      "Tax rates are applied to rental income from Real Estate properties when 'Deduct Income Tax' is enabled. Each property specifies its tax country, and the rate you configure here will be used to calculate net income after tax.",
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Existing Tax Rates */}
            {taxRates.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  {t("taxRates.configured", "Configured Rates")}
                </h3>
                {taxRates.map((rate) => (
                  <div
                    key={rate.countryCode}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center">
                      <span className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-lg font-medium text-gray-700 mr-3">
                        {rate.countryCode}
                      </span>
                      <div>
                        <span className="font-medium text-gray-900">
                          {getCountryName(rate.countryCode)}
                        </span>
                        <p className="text-sm text-gray-500">
                          {t(
                            "taxRates.appliedTo",
                            "Applied to properties in this jurisdiction",
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-semibold text-gray-900">
                        {(rate.rate * 100).toFixed(1)}%
                      </span>
                      <button
                        onClick={() => handleDeleteTaxRate(rate.countryCode)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
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
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {t("taxRates.addNew", "Add Tax Rate")}
              </h3>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("taxRates.country", "Country")}
                  </label>
                  <select
                    value={newTaxCountry}
                    onChange={(e) => setNewTaxCountry(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">
                      {t("taxRates.selectCountry", "Select country...")}
                    </option>
                    {availableCountries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.code} - {country.name}
                      </option>
                    ))}
                    {/* Allow updating existing rates */}
                    {taxRates.length > 0 && (
                      <optgroup
                        label={t("taxRates.updateExisting", "Update existing")}
                      >
                        {taxRates.map((rate) => (
                          <option
                            key={rate.countryCode}
                            value={rate.countryCode}
                          >
                            {rate.countryCode} -{" "}
                            {getCountryName(rate.countryCode)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("taxRates.rate", "Rate (%)")}
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                    <>
                      <i className="fas fa-plus mr-2"></i>
                      {t("taxRates.add", "Add")}
                    </>
                  )}
                </button>
              </div>
            </div>

            {taxRates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <i className="fas fa-percent text-4xl text-gray-300 mb-3"></i>
                <p className="font-medium">
                  {t("taxRates.empty.title", "No tax rates configured")}
                </p>
                <p className="text-sm">
                  {t(
                    "taxRates.empty.description",
                    "Add a tax rate to deduct income tax from rental properties.",
                  )}
                </p>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && <Alert>{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default withPageAuthRequired(TaxRatesPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
