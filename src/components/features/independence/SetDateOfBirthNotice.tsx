import React from "react"
import Link from "next/link"

interface SetDateOfBirthNoticeProps {
  /** Compact inline variant for embedding in a card slot. */
  compact?: boolean
}

/**
 * Shown when the user's date of birth is unset. Without it the projection
 * can't model the accumulation (working) years, so the spendable / on-track
 * figures would be misleading — we surface the gap and link to settings
 * instead of silently inventing a default birth year.
 */
export default function SetDateOfBirthNotice({
  compact = false,
}: SetDateOfBirthNoticeProps): React.ReactElement {
  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 ${compact ? "p-4" : "p-5"}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <i className="fas fa-cake-candles text-amber-500 mt-0.5"></i>
        <div className="flex-1">
          <p className="font-medium text-amber-800">
            Add your date of birth to project
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Without it we can&apos;t model your working years, so the projection
            assumes you&apos;re already retired and the spendable figures
            won&apos;t be meaningful.
          </p>
          <Link
            href="/independence?view=profile"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900"
          >
            Set date of birth
            <i className="fas fa-arrow-right text-xs"></i>
          </Link>
        </div>
      </div>
    </div>
  )
}
