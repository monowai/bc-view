import React, { useState } from "react"
import { INPUT_CLS } from "@lib/ui/formClasses"
import Alert from "@components/ui/Alert"
import IndependenceSettingsFields from "@components/features/independence/IndependenceSettingsFields"
import { useIndependenceSettingsForm } from "@components/features/independence/useIndependenceSettingsForm"

function parseNumber(value: string): number | undefined {
  return value ? Number(value) : undefined
}

export default function IndependenceSettingsPanel(): React.ReactElement {
  const form = useIndependenceSettingsForm()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (): Promise<void> => {
    const validationError = form.validate()
    if (validationError) {
      setError(validationError)
      setSaveSuccess(false)
      return
    }

    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)
    try {
      await form.save()
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
        <IndependenceSettingsFields
          monthOfBirth={form.monthOfBirth}
          onMonthOfBirthChange={form.setMonthOfBirth}
          ageDisplay={form.ageDisplay}
          targetIndependenceAge={form.targetIndependenceAge}
          lifeExpectancy={form.lifeExpectancy}
          yearOfBirthInput={
            <input
              id="settings-yearOfBirth"
              type="number"
              value={form.yearOfBirth ?? ""}
              onChange={(e) => form.setYearOfBirth(parseNumber(e.target.value))}
              min={1920}
              max={form.maxYearOfBirth}
              placeholder="YYYY"
              className={INPUT_CLS}
            />
          }
          targetIndependenceAgeInput={
            <input
              id="settings-targetIndependenceAge"
              type="number"
              value={form.targetIndependenceAge ?? ""}
              onChange={(e) =>
                form.setTargetIndependenceAge(parseNumber(e.target.value))
              }
              min={18}
              max={100}
              placeholder="e.g. 65"
              className={INPUT_CLS}
            />
          }
          lifeExpectancyInput={
            <input
              id="settings-lifeExpectancy"
              type="number"
              value={form.lifeExpectancy ?? ""}
              onChange={(e) =>
                form.setLifeExpectancy(parseNumber(e.target.value))
              }
              min={50}
              max={120}
              placeholder="e.g. 90"
              className={INPUT_CLS}
            />
          }
        />

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
