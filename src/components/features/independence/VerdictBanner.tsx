import React from "react"
import Link from "next/link"
import { Finding, FindingSeverity } from "types/independence"

interface BannerStyle {
  bg: string
  text: string
  border: string
  icon: string
  iconColor: string
}

const BANNER_STYLE: Record<FindingSeverity, BannerStyle> = {
  CRITICAL: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border border-red-200",
    icon: "fa-circle-exclamation",
    iconColor: "text-red-600",
  },
  WARNING: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border border-amber-200",
    icon: "fa-triangle-exclamation",
    iconColor: "text-amber-600",
  },
  POSITIVE: {
    bg: "bg-green-50",
    text: "text-green-800",
    border: "border border-green-200",
    icon: "fa-circle-check",
    iconColor: "text-green-600",
  },
  INFO: {
    bg: "bg-slate-50",
    text: "text-slate-800",
    border: "border border-slate-200",
    icon: "fa-circle-info",
    iconColor: "text-slate-600",
  },
}

/** Maps a finding code to an optional call-to-action. */
function ctaFor(code: string): { label: string; href: string } | null {
  if (code === "PROFILE_INCOMPLETE") {
    return { label: "Set date of birth", href: "/independence?view=profile" }
  }
  return null
}

interface VerdictBannerProps {
  /** The single top-priority finding to promote as a full-width verdict. */
  finding: Finding
}

/**
 * Full-width verdict banner displayed at the top of the Summary tab.
 * Shows the highest-priority plan finding with severity-toned styling,
 * an icon, bold title, detail text, and an optional call-to-action link.
 */
export default function VerdictBanner({
  finding,
}: VerdictBannerProps): React.ReactElement {
  const style = BANNER_STYLE[finding.severity]
  const cta = ctaFor(finding.code)

  return (
    <div
      role="status"
      aria-label={finding.title}
      className={`w-full rounded-xl px-4 py-3 flex items-start gap-3 ${style.bg} ${style.border}`}
    >
      <i
        className={`fas ${style.icon} ${style.iconColor} mt-0.5 flex-shrink-0`}
      ></i>
      <div className="flex-1">
        <p className={`text-sm font-bold ${style.text}`}>{finding.title}</p>
        <p className={`text-sm ${style.text} opacity-80`}>{finding.detail}</p>
        {cta && (
          <Link
            href={cta.href}
            className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${style.text} hover:opacity-80`}
          >
            {cta.label}
            <i className="fas fa-arrow-right text-xs"></i>
          </Link>
        )}
      </div>
    </div>
  )
}
