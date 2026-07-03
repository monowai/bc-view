import React, { useState } from "react"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import { UpdateSettingsRequest } from "types/independence"
import MathInput from "@components/ui/MathInput"
import { INPUT_CLS } from "@lib/ui/formClasses"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

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
  const { isSubmitting, submitError: error, handleSubmit, setError } =
    useDialogSubmit({
      onSuccess: onClose,
      autoCloseDelay: 0,
      fallbackError: "Failed to save settings. Please try again.",
    })

  const currentYear = new Date().getFullYear()
  // Empty when unset — never seed a plausible default the user might save
  // unchanged (it silently mis-models the whole projection).
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

  // Re-seed the form from settings whenever the modal opens or the settings
  // change. Render-phase "store previous value" pattern keyed on a stable
  // value signature (not the settings object ref, which may change identity
  // each render). Mount is handled by the lazy initializers above.
  const seedSignature = `${isOpen}:${settings?.yearOfBirth}:${settings?.monthOfBirth}:${settings?.targetIndependenceAge}:${settings?.lifeExpectancy}`
  const [prevSeedSignature, setPrevSeedSignature] = useState(seedSignature)
  if (seedSignature !== prevSeedSignature) {
    setPrevSeedSignature(seedSignature)
    if (isOpen && settings) {
      setYearOfBirth(settings.yearOfBirth ?? undefined)
      setMonthOfBirth(settings.monthOfBirth ?? undefined)
      setTargetIndependenceAge(settings.targetIndependenceAge ?? undefined)
      setLifeExpectancy(settings.lifeExpectancy ?? undefined)
      setError(null)
    }
  }

  if (!isOpen) return null

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
      return
    }
    await handleSubmit(async () => {
      const request: UpdateSettingsRequest = {
        yearOfBirth,
        monthOfBirth,
        targetIndependenceAge,
        lifeExpectancy,
      }
      await updateSettings(request)
    })
  }

  return (
    <Dialog
      title="Independence Settings"
      onClose={onClose}
      maxWidth="md"
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label="Save Settings"
            loadingLabel="Saving..."
            isSubmitting={isSubmitting}
            variant="blue"
          />
        </>
      }
    >
      <p className="text-sm text-gray-600">
        These settings apply across all your independence plans.
      </p>

      <Dialog.ErrorAlert message={error} />

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
            <MathInput
              id="settings-yearOfBirth"
              value={yearOfBirth}
              onChange={(v) => setYearOfBirth(Math.round(v))}
              min={1920}
              max={currentYear - 18}
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
          <MathInput
            id="settings-targetIndependenceAge"
            value={targetIndependenceAge}
            onChange={(v) => setTargetIndependenceAge(Math.round(v))}
            min={18}
            max={100}
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
          <MathInput
            id="settings-lifeExpectancy"
            value={lifeExpectancy}
            onChange={(v) => setLifeExpectancy(Math.round(v))}
            min={50}
            max={120}
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
      </div>
    </Dialog>
  )
}
