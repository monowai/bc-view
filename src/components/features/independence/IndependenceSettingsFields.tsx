import React from "react"
import { INPUT_CLS } from "@lib/ui/formClasses"
import { MONTHS } from "@components/features/independence/useIndependenceSettingsForm"

const LABEL_CLS = "block text-sm font-medium text-gray-700 mb-1"

interface IndependenceSettingsFieldsProps {
  monthOfBirth: number | undefined
  onMonthOfBirthChange: (value: number | undefined) => void
  yearOfBirthInput: React.ReactNode
  ageDisplay: string
  targetIndependenceAgeInput: React.ReactNode
  lifeExpectancyInput: React.ReactNode
  targetIndependenceAge: number | undefined
  lifeExpectancy: number | undefined
  retired: boolean
  onRetiredChange: (value: boolean) => void
  retiredOn: string
  onRetiredOnChange: (value: string) => void
  /** Latest selectable retired-on date (today, yyyy-MM-dd). */
  maxRetiredOn: string
}

/** Field layout of the settings form; each form supplies its numeric inputs. */
export default function IndependenceSettingsFields({
  monthOfBirth,
  onMonthOfBirthChange,
  yearOfBirthInput,
  ageDisplay,
  targetIndependenceAgeInput,
  lifeExpectancyInput,
  targetIndependenceAge,
  lifeExpectancy,
  retired,
  onRetiredChange,
  retiredOn,
  onRetiredOnChange,
  maxRetiredOn,
}: IndependenceSettingsFieldsProps): React.ReactElement {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="settings-monthOfBirth" className={LABEL_CLS}>
            Month of Birth
          </label>
          <select
            id="settings-monthOfBirth"
            value={monthOfBirth ?? ""}
            onChange={(e) =>
              onMonthOfBirthChange(
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
          <label htmlFor="settings-yearOfBirth" className={LABEL_CLS}>
            Year of Birth
          </label>
          {yearOfBirthInput}
        </div>
      </div>
      <p className="text-sm text-gray-500">Currently {ageDisplay}</p>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          id="settings-retired"
          type="checkbox"
          checked={retired}
          onChange={(e) => onRetiredChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-independence-600"
        />
        I&apos;m retired
      </label>

      {retired ? (
        <div>
          <label htmlFor="settings-retiredOn" className={LABEL_CLS}>
            Retired on
          </label>
          <input
            id="settings-retiredOn"
            type="date"
            value={retiredOn}
            max={maxRetiredOn}
            onChange={(e) => onRetiredOnChange(e.target.value)}
            className={INPUT_CLS}
          />
          <p className="mt-1 text-sm text-gray-500">
            Your plan treats you as retired from this date; the dashboard shows
            withdrawals instead of savings.
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="settings-targetIndependenceAge" className={LABEL_CLS}>
            Target Independence Age
          </label>
          {targetIndependenceAgeInput}
          <p className="mt-1 text-sm text-gray-500">
            Your baseline age for projections. You can explore different ages
            using scenarios later.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="settings-lifeExpectancy" className={LABEL_CLS}>
          Life Expectancy
        </label>
        {lifeExpectancyInput}
      </div>

      {!retired && targetIndependenceAge != null && lifeExpectancy != null && (
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
    </>
  )
}
