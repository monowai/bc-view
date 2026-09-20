import React from "react"
import Link from "next/link"

export interface TargetFieldsProps {
  planName: string
  targetIndependenceAge: number
  /**
   * Whether the profile already knows the user's date of birth. Not asked for
   * here — svc-data owns it, and this screen is about the plan.
   */
  hasDateOfBirth: boolean
  onPlanNameChange: (name: string) => void
  onTargetIndependenceAgeChange: (age: number) => void
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
          min={18}
          max={100}
          onChange={(e) =>
            onTargetIndependenceAgeChange(Number(e.target.value))
          }
          className={inputCls}
        />
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
