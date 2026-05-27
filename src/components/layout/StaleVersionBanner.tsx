import React from "react"
import { useBuildVersion } from "@hooks/useBuildVersion"

// Indirected so tests can mock without redefining window.location.
export const reloadPage = (): void => {
  window.location.reload()
}

export default function StaleVersionBanner(): React.ReactElement | null {
  const { isStale, info, initialBuild } = useBuildVersion()
  if (!isStale) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-50 bg-amber-500 text-gray-900 px-4 py-2 shadow"
      data-testid="stale-version-banner"
    >
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
        <div>
          <i className="fas fa-arrow-rotate-right mr-2" aria-hidden="true"></i>
          <span className="font-medium">New version available.</span>{" "}
          <span className="opacity-80">
            (loaded {initialBuild} → server {info?.build})
          </span>
        </div>
        <button
          type="button"
          onClick={reloadPage}
          className="inline-flex items-center gap-1 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700"
        >
          <i className="fas fa-arrow-rotate-right"></i>
          Reload
        </button>
      </div>
    </div>
  )
}
