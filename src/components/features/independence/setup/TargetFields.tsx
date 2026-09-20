import React from "react"
import Link from "next/link"

export const MIN_TARGET_AGE = 18
export const MAX_TARGET_AGE = 100
export const TARGET_AGE_RANGE_MESSAGE = `Enter a target age between ${MIN_TARGET_AGE} and ${MAX_TARGET_AGE}.`

/**
 * Reads the typed target age, or null when it is not a whole age in range.
 *
 * The field holds a raw string rather than a number so an emptied input stays
 * empty: coercing through `Number("")` produced 0, which the `min` attribute
 * does not catch (browsers do not validate a programmatic value) and which
 * became a 90-year planning horizon on a stage the user never described.
 */
export function parseTargetAge(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const age = Number(trimmed)
  return age >= MIN_TARGET_AGE && age <= MAX_TARGET_AGE ? age : null
}

export interface TargetFieldsProps {
  planName: string
  /** Raw input value — see {@link parseTargetAge}. */
  targetIndependenceAge: string
  /**
   * Whether the profile already knows the user's date of birth. Not asked for
   * here — svc-data owns it, and this screen is about the plan.
   */
  hasDateOfBirth: boolean
  /** Shown under the age field once the user has tried to continue. */
  targetAgeError?: string | null
  onPlanNameChange: (name: string) => void
  onTargetIndependenceAgeChange: (value: string) => void
}

/**
 * Name and target age. There is deliberately no date-of-birth field: the
 * profile owns it (svc-data, via `/independence?view=profile`), and a target
 * age on its own is enough for svc-retire to phase the stage — so a missing
 * birth date is a note, not a blocker.
 */
export default function TargetFields({
  planName,
  targetIndependenceAge,
  hasDateOfBirth,
  targetAgeError,
  onPlanNameChange,
  onTargetIndependenceAgeChange,
}: TargetFieldsProps): React.ReactElement {
  const inputCls =
    "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="setupPlanName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Plan name
        </label>
        <input
          id="setupPlanName"
          type="text"
          aria-label="Plan name"
          value={planName}
          maxLength={50}
          onChange={(e) => onPlanNameChange(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label
          htmlFor="setupTargetAge"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Target Independence Age
        </label>
        <input
          id="setupTargetAge"
          type="number"
          aria-label="Target independence age"
          value={targetIndependenceAge}
          min={MIN_TARGET_AGE}
          max={MAX_TARGET_AGE}
          aria-invalid={Boolean(targetAgeError)}
          aria-describedby={targetAgeError ? "setupTargetAgeError" : undefined}
          onChange={(e) => onTargetIndependenceAgeChange(e.target.value)}
          className={inputCls}
        />
        {targetAgeError && (
          <p
            id="setupTargetAgeError"
            role="alert"
            className="mt-1 text-sm text-red-600"
          >
            {targetAgeError}
          </p>
        )}
      </div>

      {!hasDateOfBirth && (
        <p className="text-sm text-gray-500">
          We read your date of birth from your profile to work out today&apos;s
          age —{" "}
          <Link
            href="/independence?view=profile"
            className="font-medium text-independence-600 underline"
          >
            add it under About you
          </Link>{" "}
          for a fuller picture.
        </p>
      )}
    </div>
  )
}
