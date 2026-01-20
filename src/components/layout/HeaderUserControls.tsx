import React, { useState } from "react"
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

  // Get display name: prefer user's preferred name, fall back to nickname
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
    <div className="relative">
      <div className="flex items-center">
        <button
          onClick={toggleHideValues}
          className="p-2 mr-2 hover:bg-gray-700 rounded transition-colors"
          title={hideValues ? "Show values" : "Hide values"}
          aria-label={hideValues ? "Show values" : "Hide values"}
        >
          <i className={`fas ${hideValues ? "fa-eye-slash" : "fa-eye"}`} />
        </button>
        <Link href="/settings" className="hover:opacity-80 transition-opacity">
          <Avatar user={user} size={30} />
        </Link>
        <div
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="ml-2 cursor-pointer hover:text-blue-600"
        >
          {displayName}
        </div>
      </div>
      {dropdownOpen && ready && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-50 text-gray-800">
          <Link
            href="/settings"
            className="block px-4 py-2 hover:bg-gray-100"
            onClick={() => setDropdownOpen(false)}
          >
            {t("settings.title")}
          </Link>
          <Link
            href="/brokers"
            className="block px-4 py-2 hover:bg-gray-100"
            onClick={() => setDropdownOpen(false)}
          >
            {t("brokers.title", "Brokers")}
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="block px-4 py-2 hover:bg-gray-100"
              onClick={() => setDropdownOpen(false)}
            >
              {t("admin.title")}
            </Link>
          )}
          <hr className="border-gray-200" />
          <Link
            href="/api/auth/logout"
            className="block px-4 py-2 hover:bg-gray-100"
          >
            {t("user.logout")}
          </Link>
        </div>
      )}
    </div>
  )
}
