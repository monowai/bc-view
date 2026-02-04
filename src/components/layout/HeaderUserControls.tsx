import React, { useState, useRef, useEffect } from "react"
import { useUser, UserProfile } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import Image from "next/image"
import { useTranslation } from "next-i18next"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { useIsAdmin } from "@hooks/useIsAdmin"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

function Avatar({
  user,
  size,
}: {
  user: UserProfile
  size: number
}): React.ReactElement {
  return (
    <Image
      src={user.picture as string}
      alt={user.name as string}
      width={size}
      height={size}
      className="rounded-full"
    />
  )
}

export default function HeaderUserControls(): React.ReactElement {
  const { user, error, isLoading } = useUser()
  const { t, ready } = useTranslation("common")
  const { preferences } = useUserPreferences()
  const { isAdmin } = useIsAdmin()
  const { hideValues, toggleHideValues } = usePrivacyMode()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return () => {}
    function handleClickOutside(event: MouseEvent): void {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownOpen])

  const displayName = preferences?.preferredName || user?.nickname

  if (isLoading)
    return (
      <div className="animate-pulse flex space-x-4">
        <div className="rounded-full bg-gray-300 h-8 w-8"></div>
        <div className="bg-gray-300 h-4 w-20 rounded"></div>
      </div>
    )
  if (error)
    return (
      <div className="text-red-500 text-sm">
        {t("auth.error")}: {error.message}
      </div>
    )
  if (!user)
    return (
      <div>
        <Link href="/api/auth/login">{t("user.login")}</Link>
      </div>
    )

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center">
        <button
          onClick={toggleHideValues}
          className="p-2 mr-2 hover:bg-gray-700 rounded transition-colors"
          title={hideValues ? "Show values" : "Hide values"}
          aria-label={hideValues ? "Show values" : "Hide values"}
        >
          <i className={`fas ${hideValues ? "fa-eye-slash" : "fa-eye"}`} />
        </button>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 hover:bg-gray-700 rounded-md px-2 py-1 transition-colors"
        >
          <Avatar user={user} size={28} />
          <span className="hidden sm:inline text-sm">{displayName}</span>
          <i
            className={`fas fa-chevron-down text-xs text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          ></i>
        </button>
      </div>
      {dropdownOpen && ready && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 text-gray-800 overflow-hidden py-1">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => setDropdownOpen(false)}
          >
            <i className="fas fa-cog w-4 text-center text-xs text-gray-400"></i>
            {t("settings.title")}
          </Link>
          <Link
            href="/brokers"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => setDropdownOpen(false)}
          >
            <i className="fas fa-building w-4 text-center text-xs text-gray-400"></i>
            {t("brokers.title", "Brokers")}
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setDropdownOpen(false)}
            >
              <i className="fas fa-tools w-4 text-center text-xs text-gray-400"></i>
              {t("admin.title")}
            </Link>
          )}
          <hr className="my-1 border-gray-100" />
          <Link
            href="/api/auth/logout"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <i className="fas fa-sign-out-alt w-4 text-center text-xs"></i>
            {t("user.logout")}
          </Link>
        </div>
      )}
    </div>
  )
}
