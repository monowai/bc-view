import React, { useState, useEffect } from "react"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import { UpdateSettingsRequest } from "types/independence"

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

function calculateAge(
  yearOfBirth: number,
  monthOfBirth?: number,
): { years: number; display: string } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-based
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

interface IndependenceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function IndependenceSettingsModal({
  isOpen,
  onClose,
}: IndependenceSettingsModalProps): React.ReactElement | null {
  const { settings, updateSettings } = useIndependenceSettings()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const [yearOfBirth, setYearOfBirth] = useState<number>(currentYear - 55)
  const [monthOfBirth, setMonthOfBirth] = useState<number | undefined>(
    undefined,
  )
  const [targetIndependenceAge, setTargetIndependenceAge] = useState<number>(65)
  const [lifeExpectancy, setLifeExpectancy] = useState<number>(90)

  useEffect(() => {
    if (isOpen && settings) {
      setYearOfBirth(settings.yearOfBirth ?? currentYear - 55)
      setMonthOfBirth(settings.monthOfBirth ?? undefined)
      setTargetIndependenceAge(settings.targetIndependenceAge ?? 65)
      setLifeExpectancy(settings.lifeExpectancy ?? 90)
      setError(null)
    }
  }, [isOpen, settings, currentYear])

  if (!isOpen) return null

  const { years: currentAge, display: ageDisplay } = calculateAge(
    yearOfBirth,
    monthOfBirth,
  )

  const validate = (): string | null => {
    if (yearOfBirth < 1920 || yearOfBirth > currentYear - 18) {
      return `Year of birth must be between 1920 and ${currentYear - 18}`
    }
    if (monthOfBirth !== undefined && (monthOfBirth < 1 || monthOfBirth > 12)) {
      return "Month must be between 1 and 12"
    }
    if (targetIndependenceAge < currentAge) {
      return "Target independence age must be at or after your current age"
    }
    if (targetIndependenceAge < 18 || targetIndependenceAge > 100) {
      return "Target independence age must be between 18 and 100"
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
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const request: UpdateSettingsRequest = {
        yearOfBirth,
        monthOfBirth,
        targetIndependenceAge,
        lifeExpectancy,
      }
      await updateSettings(request)
      onClose()
    } catch {
      setError("Failed to save settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Independence Settings
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          These settings apply across all your independence plans.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
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
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 border-gray-300"
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
                value={yearOfBirth}
                onChange={(e) => setYearOfBirth(Number(e.target.value))}
                min={1920}
                max={currentYear - 18}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 border-gray-300"
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
              value={targetIndependenceAge}
              onChange={(e) =>
                setTargetIndependenceAge(Number(e.target.value))
              }
              min={18}
              max={100}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 border-gray-300"
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
              value={lifeExpectancy}
              onChange={(e) => setLifeExpectancy(Number(e.target.value))}
              min={50}
              max={120}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 border-gray-300"
            />
          </div>

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
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 px-4 bg-independence-500 text-white rounded-lg font-medium hover:bg-independence-600 transition-colors disabled:opacity-50"
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
    </div>
  )
}
