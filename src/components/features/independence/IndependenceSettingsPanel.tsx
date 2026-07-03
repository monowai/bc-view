import React, { useState } from "react"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import { UpdateSettingsRequest } from "types/independence"
import { INPUT_CLS } from "@lib/ui/formClasses"
import Alert from "@components/ui/Alert"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function calculateAge(
  yearOfBirth: number,
  monthOfBirth?: number,
): { years: number; display: string } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  let age = currentYear - yearOfBirth
  if (monthOfBirth && currentMonth < monthOfBirth) {
    age -= 1
  }
  const display =
    monthOfBirth && currentMonth < monthOfBirth
      ? `${age} (turning ${age + 1} in ${MONTHS[monthOfBirth - 1]})`
      : `${age}`
  return { years: age, display }
}

export default function IndependenceSettingsPanel(): React.ReactElement {
  const { settings, updateSettings } = useIndependenceSettings()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  // Leave empty when unset — don't seed a plausible-looking default the user
  // might save unchanged (which silently mis-models their whole projection).
  const [yearOfBirth, setYearOfBirth] = useState<number | undefined>(
    settings?.yearOfBirth ?? undefined,
  )
  const [monthOfBirth, setMonthOfBirth] = useState<number | undefined>(
    settings?.monthOfBirth ?? undefined,
  )
  const [targetIndependenceAge, setTargetIndependenceAge] = useState<
    number | undefined
  >(settings?.targetIndependenceAge ?? undefined)
  const [lifeExpectancy, setLifeExpectancy] = useState<number | undefined>(
    settings?.lifeExpectancy ?? undefined,
  )

  // Re-seed the form whenever settings change. Render-phase "store previous
  // value" pattern keyed on a stable value signature (not the settings object
  // ref). Mount is handled by the lazy initializers above.
  const seedSignature = `${settings?.yearOfBirth}:${settings?.monthOfBirth}:${settings?.targetIndependenceAge}:${settings?.lifeExpectancy}`
  const [prevSeedSignature, setPrevSeedSignature] = useState(seedSignature)
  if (seedSignature !== prevSeedSignature) {
    setPrevSeedSignature(seedSignature)
    if (settings) {
      setYearOfBirth(settings.yearOfBirth ?? undefined)
      setMonthOfBirth(settings.monthOfBirth ?? undefined)
      setTargetIndependenceAge(settings.targetIndependenceAge ?? undefined)
      setLifeExpectancy(settings.lifeExpectancy ?? undefined)
    }
  }

  const { years: currentAge, display: ageDisplay } =
    yearOfBirth != null
      ? calculateAge(yearOfBirth, monthOfBirth)
      : { years: 0, display: "—" }

  const validate = (): string | null => {
    if (yearOfBirth == null) {
      return "Year of birth is required"
    }
    if (yearOfBirth < 1920 || yearOfBirth > currentYear - 18) {
      return `Year of birth must be between 1920 and ${currentYear - 18}`
    }
    if (monthOfBirth == null) {
      return "Month of birth is required"
    }
    if (monthOfBirth < 1 || monthOfBirth > 12) {
      return "Month must be between 1 and 12"
    }
    if (targetIndependenceAge == null) {
      return "Target independence age is required"
    }
    if (targetIndependenceAge < currentAge) {
      return "Target independence age must be at or after your current age"
    }
    if (targetIndependenceAge < 18 || targetIndependenceAge > 100) {
      return "Target independence age must be between 18 and 100"
    }
    if (lifeExpectancy == null) {
      return "Life expectancy is required"
    }
    if (lifeExpectancy <= targetIndependenceAge) {
      return "Life expectancy must be after target independence age"
    }
    if (lifeExpectancy < 50 || lifeExpectancy > 120) {
      return "Life expectancy must be between 50 and 120"
    }
    return null
  }

  const handleSave = async (): Promise<void> => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      setSaveSuccess(false)
      return
    }

    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)
    try {
      const request: UpdateSettingsRequest = {
        yearOfBirth,
        monthOfBirth,
        targetIndependenceAge,
        lifeExpectancy,
      }
      await updateSettings(request)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError("Failed to save settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg">
      <p className="text-sm text-gray-600 mb-6">
        These settings apply across all your independence plans and composite
        projections.
      </p>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {saveSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <i className="fas fa-check mr-2"></i>
          Settings saved successfully.
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="settings-monthOfBirth"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Month of Birth
            </label>
            <select
              id="settings-monthOfBirth"
              value={monthOfBirth ?? ""}
              onChange={(e) =>
                setMonthOfBirth(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              className={INPUT_CLS}
            >
              <option value="">--</option>
              {MONTHS.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="settings-yearOfBirth"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Year of Birth
            </label>
            <input
              id="settings-yearOfBirth"
              type="number"
              value={yearOfBirth ?? ""}
              onChange={(e) =>
                setYearOfBirth(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              min={1920}
              max={currentYear - 18}
              placeholder="YYYY"
              className={INPUT_CLS}
            />
          </div>
        </div>
        <p className="text-sm text-gray-500">Currently {ageDisplay}</p>

        <div>
          <label
            htmlFor="settings-targetIndependenceAge"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Target Independence Age
          </label>
          <input
            id="settings-targetIndependenceAge"
            type="number"
            value={targetIndependenceAge ?? ""}
            onChange={(e) =>
              setTargetIndependenceAge(
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            min={18}
            max={100}
            placeholder="e.g. 65"
            className={INPUT_CLS}
          />
          <p className="mt-1 text-sm text-gray-500">
            Your baseline age for projections. You can explore different ages
            using scenarios later.
          </p>
        </div>

        <div>
          <label
            htmlFor="settings-lifeExpectancy"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Life Expectancy
          </label>
          <input
            id="settings-lifeExpectancy"
            type="number"
            value={lifeExpectancy ?? ""}
            onChange={(e) =>
              setLifeExpectancy(
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            min={50}
            max={120}
            placeholder="e.g. 90"
            className={INPUT_CLS}
          />
        </div>

        {targetIndependenceAge != null && lifeExpectancy != null && (
          <div className="bg-independence-50 border border-independence-200 rounded-lg p-4">
            <div className="flex">
              <i className="fas fa-info-circle text-independence-600 mt-0.5 mr-3"></i>
              <div className="text-sm text-independence-700">
                <p className="font-medium">Planning horizon</p>
                <p className="mt-1">
                  Your planning horizon will be{" "}
                  {lifeExpectancy - targetIndependenceAge} years (from age{" "}
                  {targetIndependenceAge} to {lifeExpectancy}).
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-2 px-4 bg-independence-500 text-white rounded-lg font-medium hover:bg-independence-600 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Saving...
            </>
          ) : (
            <>
              <i className="fas fa-check mr-2"></i>
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  )
}
