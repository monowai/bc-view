import React, { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import { useUser } from "@auth0/nextjs-auth0/client"
import { usePermissions } from "@hooks/usePermissions"
import { usePortfolios } from "@hooks/usePortfolios"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { deriveZenModeFromPreferences } from "@lib/user/zenMode"
import PayslipModal from "@components/features/transactions/PayslipModal"

// Sentinel `action` values for nav items that open a modal instead of
// navigating. The href is kept (as a hash) so existing rendering still works.
type NavAction = "payslip"

interface NavItem {
  href: string
  label: string
  icon: string
  description?: string
  adminOnly?: boolean
  aiOnly?: boolean
  // Hidden in zen mode (single portfolio) — there's no list to browse.
  zenHidden?: boolean
  action?: NavAction
}

interface NavSection {
  title: string
  items: NavItem[]
}

// Main nav: core domain actions only.
// Settings and Admin live in the user menu (HeaderUserControls).
// Brokers (incl. Open Brokerage, reachable from /brokers) lives under Tools.
const navSections: NavSection[] = [
  {
    title: "Wealth",
    items: [
      { href: "/wealth", label: "Net Worth", icon: "fa-coins" },
      {
        href: "/portfolios",
        label: "Portfolios",
        icon: "fa-chart-pie",
        zenHidden: true,
      },
      { href: "/accounts", label: "Assets", icon: "fa-gem" },
      { href: "/allocation", label: "Allocation", icon: "fa-chart-bar" },
    ],
  },
  {
    title: "Plan",
    items: [
      {
        href: "/independence",
        label: "Independence",
        icon: "fa-umbrella-beach",
      },
    ],
  },
  {
    title: "Invest",
    items: [
      { href: "/rebalance/models", label: "Models", icon: "fa-balance-scale" },
      {
        href: "/trns/proposed",
        label: "Transactions",
        icon: "fa-exchange-alt",
      },
      { href: "/assets/lookup", label: "Asset Lookup", icon: "fa-search" },
      { href: "/news", label: "News", icon: "fa-newspaper" },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/chat", label: "Chat", icon: "fa-robot", aiOnly: true },
      {
        href: "#enter-payslip",
        label: "Enter Payslip",
        icon: "fa-money-check-dollar",
        action: "payslip",
      },
      { href: "/brokers", label: "Brokers", icon: "fa-building" },
      {
        href: "/tools/cost-stack",
        label: "Cost Stack",
        icon: "fa-layer-group",
      },
      { href: "/fx", label: "FX Rates", icon: "fa-exchange-alt" },
      { href: "/fx/calculator", label: "FX Calculator", icon: "fa-calculator" },
      { href: "/tax-rates", label: "Tax Rates", icon: "fa-percent" },
    ],
  },
  // Admin is a top-level section; every item is adminOnly so the whole
  // section hides for non-admins (NavDropdown returns null on no items).
  {
    title: "Admin",
    items: [
      { href: "/admin", label: "Overview", icon: "fa-gauge", adminOnly: true },
      {
        href: "/admin/services",
        label: "Services",
        icon: "fa-server",
        adminOnly: true,
      },
      {
        href: "/admin/tasks",
        label: "Tasks",
        icon: "fa-list-check",
        adminOnly: true,
      },
      {
        href: "/admin/metrics",
        label: "Metrics",
        icon: "fa-chart-line",
        adminOnly: true,
      },
      {
        href: "/admin/loggers",
        label: "Loggers",
        icon: "fa-file-lines",
        adminOnly: true,
      },
      {
        href: "/admin/assets",
        label: "Assets",
        icon: "fa-gem",
        adminOnly: true,
      },
      {
        href: "/admin/accounting-types",
        label: "Accounting Types",
        icon: "fa-list",
        adminOnly: true,
      },
      {
        href: "/admin/scenarios",
        label: "Scenarios",
        icon: "fa-diagram-project",
        adminOnly: true,
      },
    ],
  },
]

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

// Active-item colors. Text uses the 700 tier so it clears 4.5:1 on the matching
// -50 background (600 fails for independence/invest). No left-stripe accent —
// the tinted background + colored text carry the active state (see DESIGN.md:
// no border-left > 1px as a colored stripe).
const sectionColors: Record<string, { bg: string; text: string }> = {
  Wealth: { bg: "bg-wealth-50", text: "text-wealth-700" },
  Invest: { bg: "bg-invest-50", text: "text-invest-700" },
  Plan: { bg: "bg-independence-50", text: "text-independence-700" },
  Tools: { bg: "bg-gray-50", text: "text-gray-700" },
  Admin: { bg: "bg-gray-50", text: "text-gray-700" },
}

const defaultSectionColor = {
  bg: "bg-gray-50",
  text: "text-gray-700",
}

function filterNavItems(
  items: NavItem[],
  isAdmin: boolean,
  canRunAi: boolean,
  zenMode: boolean,
): NavItem[] {
  return items.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.aiOnly || canRunAi) &&
      (!item.zenHidden || !zenMode),
  )
}

// One nav entry — shared by the desktop dropdowns and the mobile drawer so
// both surfaces keep the same vocabulary. `dense` is the desktop dropdown
// sizing; the drawer gets roomier tap targets.
function NavItemRow({
  item,
  active,
  colors,
  dense = false,
  onNavigate,
  onAction,
}: {
  item: NavItem
  active: boolean
  colors: { bg: string; text: string }
  dense?: boolean
  onNavigate: () => void
  onAction: (action: NavAction) => void
}): React.ReactElement {
  const rowClass = `flex items-center ${
    dense ? "gap-2.5 px-3 py-2" : "gap-3 px-4 py-2.5"
  } text-sm transition-colors ${
    active
      ? `${colors.bg} ${colors.text} font-medium`
      : "text-gray-700 hover:bg-gray-50"
  }`
  const icon = (
    <i
      className={`fas ${item.icon} ${dense ? "w-4 text-xs" : "w-5 text-sm"} text-center ${
        active ? colors.text : "text-gray-400"
      }`}
    ></i>
  )
  if (item.action) {
    const action = item.action
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate()
          onAction(action)
        }}
        className={`${rowClass} w-full text-left`}
      >
        {icon}
        {item.label}
      </button>
    )
  }
  return (
    <Link href={item.href} onClick={onNavigate} className={rowClass}>
      {icon}
      {item.label}
    </Link>
  )
}

// Desktop dropdown — opens on hover with a close delay, click also toggles
function DesktopDropdown({
  section,
  isAdmin,
  canRunAi,
  zenMode,
  router,
  onAction,
}: {
  section: NavSection
  isAdmin: boolean
  canRunAi: boolean
  zenMode: boolean
  router: ReturnType<typeof useRouter>
  onAction: (action: NavAction) => void
}): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const cancelClose = useCallback((): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback((): void => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 200)
  }, [cancelClose])

  useEffect(() => {
    return () => cancelClose()
  }, [cancelClose])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return () => {}
    function handleClickOutside(event: MouseEvent): void {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const filteredItems = filterNavItems(
    section.items,
    isAdmin,
    canRunAi,
    zenMode,
  )
  const isActive = filteredItems.some((item) =>
    isActiveRoute(router.pathname, item.href),
  )

  // Hide a section with nothing visible (e.g. the Admin section for
  // non-admins) so we don't render an empty dropdown button.
  if (filteredItems.length === 0) return null

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          cancelClose()
          setIsOpen(true)
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") {
          scheduleClose()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && isOpen) {
          setIsOpen(false)
        }
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`relative flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          isActive
            ? "text-white bg-gray-700 after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-blue-400 after:content-['']"
            : "text-gray-300 hover:text-white hover:bg-gray-700"
        }`}
      >
        {section.title}
        <i
          className={`fas fa-chevron-down ml-1.5 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}
        ></i>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-52 bg-white rounded-lg shadow-[0_2px_10px_rgb(0_0_0/0.1)] border border-gray-200 z-50 overflow-hidden py-1 text-gray-800 animate-menu-in">
          {filteredItems.map((item) => (
            <NavItemRow
              key={item.href}
              item={item}
              active={isActiveRoute(router.pathname, item.href)}
              colors={sectionColors[section.title] || defaultSectionColor}
              dense
              onNavigate={() => setIsOpen(false)}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function HeaderBrand(): React.ReactElement {
  const router = useRouter()
  const { user } = useUser()
  const { admin: isAdmin, ai: canRunAi } = usePermissions()
  const { portfolios } = usePortfolios()
  const { preferences } = useUserPreferences()
  // Zen mode (single portfolio) drops portfolio-list nav entries — nothing to
  // browse. Shared helper so it tracks the rest of bc-view's zen behaviour.
  const zenMode = deriveZenModeFromPreferences(portfolios.length, preferences)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [payslipOpen, setPayslipOpen] = useState(false)
  const isAuthed = !!user

  const openAction = useCallback(
    (action: NavAction): void => {
      if (action === "payslip") setPayslipOpen(true)
    },
    [setPayslipOpen],
  )

  const closeMobileMenu = useCallback((): void => {
    setMobileMenuOpen(false)
  }, [setMobileMenuOpen])

  // Close mobile menu on Escape — document-level so it works regardless of
  // which element inside the drawer holds focus.
  useEffect(() => {
    if (!mobileMenuOpen) return () => {}
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setMobileMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [mobileMenuOpen])

  // Close mobile menu on route change. Subscribe to the router event rather
  // than calling setState synchronously inside an effect body — the event
  // callback runs only when the route actually changes.
  useEffect(() => {
    const close = (): void => setMobileMenuOpen(false)
    router.events.on("routeChangeStart", close)
    return () => router.events.off("routeChangeStart", close)
  }, [router.events])

  // Lock background scroll while the mobile menu is open. Plain
  // `overflow: hidden` on body is ignored by iOS Safari for touch scrolling,
  // so freeze the body with `position: fixed` (offset by the current scroll)
  // and restore the scroll position on close — the only reliable cross-browser
  // lock.
  useEffect(() => {
    if (!mobileMenuOpen) return () => {}
    const { body } = document
    const scrollY = window.scrollY
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = "fixed"
    body.style.top = `-${scrollY}px`
    body.style.width = "100%"
    body.style.overflow = "hidden"
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [mobileMenuOpen])

  return (
    <div className="flex items-center">
      {/* Mobile Menu Button — hidden when unauthenticated */}
      {isAuthed && (
        <div className="lg:hidden mr-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="dialog"
            aria-label="Navigation menu"
          >
            {mobileMenuOpen ? (
              <i className="fas fa-times text-white text-lg w-5"></i>
            ) : (
              <i className="fas fa-bars text-white text-lg w-5"></i>
            )}
          </button>

          {/* Backdrop — tap anywhere outside the drawer to dismiss */}
          {mobileMenuOpen && (
            <div
              data-testid="mobile-nav-backdrop"
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={closeMobileMenu}
            />
          )}

          {/* Mobile drawer — slides in from the left edge on open; unmounted
              while closed so its links stay out of the tab order. */}
          {mobileMenuOpen && (
            <div
              role="dialog"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-[0_2px_10px_rgb(0_0_0/0.1)] lg:hidden animate-drawer-in"
            >
              <div className="flex items-center justify-between bg-gray-800 px-4 py-3 text-white">
                <span className="text-lg font-bold">
                  Holds<i>worth</i>
                </span>
                <button
                  onClick={closeMobileMenu}
                  aria-label="Close menu"
                  className="rounded p-1 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <i className="fas fa-times w-5 text-center text-lg"></i>
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto overscroll-contain py-2">
                {navSections.map((section) => {
                  const filteredItems = filterNavItems(
                    section.items,
                    isAdmin,
                    canRunAi,
                    zenMode,
                  )
                  if (filteredItems.length === 0) return null
                  return (
                    <div key={section.title}>
                      <p className="px-4 pb-1 pt-4 text-xs font-semibold tracking-wide text-gray-500">
                        {section.title}
                      </p>
                      {filteredItems.map((item) => (
                        <NavItemRow
                          key={item.href}
                          item={item}
                          active={isActiveRoute(router.pathname, item.href)}
                          colors={
                            sectionColors[section.title] || defaultSectionColor
                          }
                          onNavigate={closeMobileMenu}
                          onAction={openAction}
                        />
                      ))}
                    </div>
                  )
                })}
              </nav>
            </div>
          )}
        </div>
      )}

      {/* Brand */}
      <Link
        href="/"
        className="text-xl font-bold text-white hover:text-gray-200 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        Holds<i>worth</i>
      </Link>

      {/* In-development badge — visible to everyone (incl. unauthenticated
          visitors) so it's clear the app is a work in progress. Links to the
          repo where feedback and contributions are welcome. */}
      <a
        href="https://github.com/monowai/bc-view"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="In active development — feedback and contributions welcome"
        title="In active development — feedback & contributions welcome"
        className="ml-2 inline-flex items-center rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-900 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        Beta
      </a>

      {/* Desktop Navigation — hidden when unauthenticated */}
      {isAuthed && (
        <nav className="hidden lg:flex items-center ml-8 space-x-1">
          {navSections.map((section) => (
            <DesktopDropdown
              key={section.title}
              section={section}
              isAdmin={isAdmin}
              canRunAi={canRunAi}
              zenMode={zenMode}
              router={router}
              onAction={openAction}
            />
          ))}
        </nav>
      )}

      {/* Tools → Enter Payslip modal, rendered once for the whole header. */}
      {isAuthed && (
        <PayslipModal
          modalOpen={payslipOpen}
          onClose={() => setPayslipOpen(false)}
        />
      )}
    </div>
  )
}

export default HeaderBrand
