import React from "react"
import Link from "next/link"
import { Finding, FindingSeverity } from "types/independence"

interface PlanFindingsCardProps {
  findings: Finding[] | undefined
}

interface SeverityStyle {
  icon: string
  iconColor: string
  border: string
}

const SEVERITY_STYLE: Record<FindingSeverity, SeverityStyle> = {
  CRITICAL: {
    icon: "fa-circle-exclamation",
    iconColor: "text-red-500",
    border: "border-l-red-400",
  },
  WARNING: {
    icon: "fa-triangle-exclamation",
    iconColor: "text-amber-500",
    border: "border-l-amber-400",
  },
  POSITIVE: {
    icon: "fa-circle-check",
    iconColor: "text-green-500",
    border: "border-l-green-400",
  },
  INFO: {
    icon: "fa-circle-info",
    iconColor: "text-gray-400",
    border: "border-l-gray-300",
  },
}

/**
 * Findings that only matter under a FIRE / early-retirement lens (4% SWR,
 * 25× expenses, Coast FI). The backend emits them regardless of strategy, so
 * we tag them in the UI — a PENSION/HYBRID planner can ignore them.
 */
const FIRE_FINDING_CODES = new Set([
  "HORIZON_EXCEEDS_FIRE_WINDOW",
  "REAL_RETURN_BELOW_SWR",
  "COAST_FI_REACHED",
])

/** Maps a finding code to an optional call-to-action. */
function ctaFor(code: string): { label: string; href: string } | null {
  if (code === "PROFILE_INCOMPLETE") {
    return { label: "Set date of birth", href: "/independence?view=profile" }
  }
  return null
}

/**
 * Plan Insights — the situational signals derived by the backend
 * (`projection.findings`), rendered as a list instead of being buried in
 * gauge tooltips. Renders nothing when there are no findings.
 */
export default function PlanFindingsCard({
  findings,
}: PlanFindingsCardProps): React.ReactElement | null {
  if (!findings || findings.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        <i className="fas fa-clipboard-check text-independence-500 mr-2"></i>
        Plan Insights
      </h2>
      <ul className="space-y-3">
        {findings.map((finding) => {
          const style = SEVERITY_STYLE[finding.severity]
          const cta = ctaFor(finding.code)
          return (
            <li
              key={finding.code}
              className={`border-l-2 ${style.border} pl-3`}
            >
              <div className="flex items-start gap-2">
                <i
                  className={`fas ${style.icon} ${style.iconColor} mt-0.5`}
                ></i>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {finding.title}
                    {FIRE_FINDING_CODES.has(finding.code) && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 align-middle"
                        title="FIRE-specific — assumes the 4% safe-withdrawal / 25× rule. Ignore if you're not planning early retirement."
                      >
                        <i className="fas fa-fire text-xs"></i>
                        FIRE
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">{finding.detail}</p>
                  {cta && (
                    <Link
                      href={cta.href}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-independence-600 hover:text-independence-700"
                    >
                      {cta.label}
                      <i className="fas fa-arrow-right text-xs"></i>
                    </Link>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
