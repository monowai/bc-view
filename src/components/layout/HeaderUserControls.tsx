import React, { useState } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import { useTranslation } from "next-i18next"
import { getAvatar } from "@pages/profile"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

export default function HeaderUserControls(): React.ReactElement {
  const { user, error, isLoading } = useUser()
  const { t } = useTranslation("common")
  const { preferences } = useUserPreferences()
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
        <div
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="cursor-pointer"
        >
          {getAvatar(user, 30)}
        </div>
        <div className="ml-2">{displayName}</div>
      </div>
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-50 text-gray-800">
          <Link
            href="/settings"
            className="block px-4 py-2 hover:bg-gray-100"
            onClick={() => setDropdownOpen(false)}
          >
            {t("settings.title")}
          </Link>
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
