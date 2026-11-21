import React, { useState, useRef, useEffect } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import type { User } from "@auth0/nextjs-auth0/types"
import Link from "next/link"
import Image from "next/image"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

function Avatar({
  user,
  size,
}: {
  user: User
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

const userMenuLinks: { href: string; label: string; icon: string }[] = [
  { href: "/settings", label: "Settings", icon: "fa-cog" },
  { href: "/milestones", label: "Milestones", icon: "fa-trophy" },
  { href: "/shares", label: "Shares", icon: "fa-share-alt" },
]

export default function HeaderUserControls(): React.ReactElement {
  // Auth0 v4 surfaces 401 from /auth/profile as `error` rather than a clean
  // `user: undefined` — for header UX, treat error the same as unauthenticated
  // and show the Sign In CTA.
  const { user, isLoading } = useUser()
  const { preferences } = useUserPreferences()
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
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setDropdownOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKey)
    }
  }, [dropdownOpen])

  const displayName = preferences?.preferredName || user?.nickname

  if (isLoading)
    return (
      <div className="animate-pulse flex space-x-4">
        <div className="rounded-full bg-gray-300 h-8 w-8"></div>
        <div className="bg-gray-300 h-4 w-20 rounded"></div>
      </div>
    )
  if (!user)
    return (
      <Link href="/auth/login" className="btn-primary btn-primary--sm">
        {"Sign In"}
      </Link>
    )

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center">
        <button
          onClick={toggleHideValues}
          className="p-2 mr-2 hover:bg-gray-700 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          title={hideValues ? "Show values" : "Hide values"}
          aria-label={hideValues ? "Show values" : "Hide values"}
        >
          <i className={`fas ${hideValues ? "fa-eye-slash" : "fa-eye"}`} />
        </button>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
          className="flex items-center gap-2 hover:bg-gray-700 rounded-md px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Avatar user={user} size={28} />
          <span className="hidden sm:inline text-sm">{displayName}</span>
          <span className="hidden sm:inline">
            <i
              className={`fas fa-chevron-down text-xs text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            ></i>
          </span>
        </button>
      </div>
      {dropdownOpen && (
        <div className="menu-panel absolute right-0 top-full z-50 mt-1.5 w-60 origin-top-right animate-menu-in">
          {/* Who is signed in — the trigger hides the name below sm. */}
          <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
            <Avatar user={user} size={32} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {displayName}
              </p>
              {user.email && (
                <p className="truncate text-xs text-gray-500">{user.email}</p>
              )}
            </div>
          </div>
          <div role="separator" className="menu-sep" />
          {userMenuLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="menu-row"
              onClick={() => setDropdownOpen(false)}
            >
              <i
                aria-hidden="true"
                className={`fas ${link.icon} menu-icon`}
              ></i>
              {link.label}
            </Link>
          ))}
          <div role="separator" className="menu-sep" />
          <a href="/auth/logout" className="menu-row menu-row--danger">
            <i aria-hidden="true" className="fas fa-sign-out-alt menu-icon"></i>
            {"Logout"}
          </a>
        </div>
      )}
    </div>
  )
}
