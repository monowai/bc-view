import { useCallback, useState } from "react"
import { TaxRate } from "types/beancounter"
import { deleteTaxRate, saveTaxRate } from "@utils/api/client/account"

// Common country codes for tax rate configuration
const COUNTRY_OPTIONS = [
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
]

interface TaxRateEditor {
  taxRates: TaxRate[]
  setTaxRates: React.Dispatch<React.SetStateAction<TaxRate[]>>
  newTaxCountry: string
  setNewTaxCountry: (code: string) => void
  newTaxRate: string
  setNewTaxRate: (rate: string) => void
  taxRateSaving: boolean
  handleAddTaxRate: () => Promise<void>
  handleDeleteTaxRate: (countryCode: string) => Promise<void>
  getCountryName: (code: string) => string
  availableCountries: typeof COUNTRY_OPTIONS
}

/**
 * Add, update and delete the user's tax rates. The page owns loading the rates
 * (`setTaxRates`) and where errors and confirmations are shown.
 */
export function useTaxRateEditor({
  setError,
  setSuccess,
}: {
  setError: (message: string | null) => void
  setSuccess: (message: string | null) => void
}): TaxRateEditor {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [newTaxCountry, setNewTaxCountry] = useState("")
  const [newTaxRate, setNewTaxRate] = useState("")
  const [taxRateSaving, setTaxRateSaving] = useState(false)

  // Add or update a tax rate
  const handleAddTaxRate = useCallback(async (): Promise<void> => {
    if (!newTaxCountry || !newTaxRate) return

    const rate = parseFloat(newTaxRate) / 100 // Convert percentage to decimal
    if (isNaN(rate) || rate < 0 || rate > 1) {
      setError("Rate must be between 0 and 100%")
      return
    }

    setTaxRateSaving(true)
    setError(null)

    try {
      const response = await saveTaxRate({ countryCode: newTaxCountry, rate })

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
  }, [newTaxCountry, newTaxRate, setError, setSuccess])

  // Delete a tax rate
  const handleDeleteTaxRate = useCallback(
    async (countryCode: string): Promise<void> => {
      try {
        const response = await deleteTaxRate(countryCode)

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
    [setError, setSuccess],
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

  return {
    taxRates,
    setTaxRates,
    newTaxCountry,
    setNewTaxCountry,
    newTaxRate,
    setNewTaxRate,
    taxRateSaving,
    handleAddTaxRate,
    handleDeleteTaxRate,
    getCountryName,
    availableCountries,
  }
}
