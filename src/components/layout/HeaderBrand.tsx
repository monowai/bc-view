import React, { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import { useUser } from "@auth0/nextjs-auth0/client"
import { usePermissions } from "@hooks/usePermissions"
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
  action?: NavAction
}

interface NavSection {
  title: string
  items: NavItem[]
}

// Main nav: core domain actions only.
// Settings, Brokers, Admin live in the user menu (HeaderUserControls).
const navSections: NavSection[] = [
  {
    title: "Wealth",
    items: [
      { href: "/wealth", label: "Net Worth", icon: "fa-coins" },
      { href: "/portfolios", label: "Portfolios", icon: "fa-chart-pie" },
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
      {
        href: "/tools/open-brokerage",
        label: "Open Brokerage",
        icon: "fa-building-columns",
      },
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

// Desktop dropdown — opens on hover with a close delay, click also toggles
function DesktopDropdown({
  section,
  isAdmin,
  canRunAi,
  router,
  onAction,
}: {
  section: NavSection
  isAdmin: boolean
  canRunAi: boolean
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

  const filteredItems = section.items.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.aiOnly || canRunAi),
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
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          isActive
            ? "text-white bg-gray-700"
            : "text-gray-300 hover:text-white hover:bg-gray-700"
        }`}
      >
        {section.title}
        <i
          className={`fas fa-chevron-down ml-1.5 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}
        ></i>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden py-1 text-gray-800">
          {filteredItems.map((item) => {
            const active = isActiveRoute(router.pathname, item.href)
            const colors = sectionColors[section.title] || defaultSectionColor
            const itemClass = `flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
              active
                ? `${colors.bg} ${colors.text} font-medium`
                : "text-gray-700 hover:bg-gray-50"
            }`
            const itemIcon = (
              <i
                className={`fas ${item.icon} w-4 text-center text-xs ${
                  active ? colors.text : "text-gray-400"
                }`}
              ></i>
            )
            if (item.action) {
              const action = item.action
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    onAction(action)
                  }}
                  className={`${itemClass} w-full text-left`}
                >
                  {itemIcon}
                  {item.label}
                </button>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={itemClass}
              >
                {itemIcon}
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HeaderBrand(): React.ReactElement {
  const router = useRouter()
  const { user } = useUser()
  const { admin: isAdmin, ai: canRunAi } = usePermissions()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [payslipOpen, setPayslipOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const isAuthed = !!user

  const openAction = useCallback((action: NavAction): void => {
    if (action === "payslip") setPayslipOpen(true)
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return () => {}
    function handleClickOutside(event: MouseEvent): void {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
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

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className="flex items-center" ref={mobileMenuRef}>
      {/* Mobile Menu Button — hidden when unauthenticated */}
      {isAuthed && (
        <div className="relative lg:hidden mr-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            onKeyDown={handleKeyDown}
            className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="true"
            aria-label="Navigation menu"
          >
            {mobileMenuOpen ? (
              <i className="fas fa-times text-white text-lg w-5"></i>
            ) : (
              <i className="fas fa-bars text-white text-lg w-5"></i>
            )}
          </button>

          {/* Mobile Dropdown */}
          {mobileMenuOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden text-gray-800">
              <div className="py-2 max-h-[75vh] overflow-y-auto overscroll-contain">
                {navSections.map((section, sectionIdx) => {
                  const filteredItems = section.items.filter(
                    (item) =>
                      (!item.adminOnly || isAdmin) &&
                      (!item.aiOnly || canRunAi),
                  )
                  if (filteredItems.length === 0) return null
                  return (
                    <div key={section.title}>
                      {sectionIdx > 0 && (
                        <hr className="my-1.5 border-gray-100" />
                      )}
                      <div className="px-3 py-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {section.title}
                        </p>
                      </div>
                      {filteredItems.map((item) => {
                        const active = isActiveRoute(router.pathname, item.href)
                        const colors =
                          sectionColors[section.title] || defaultSectionColor
                        const itemClass = `flex items-center gap-2.5 px-3 py-2 transition-colors ${
                          active
                            ? `${colors.bg} ${colors.text} font-medium`
                            : "text-gray-700 hover:bg-gray-50"
                        }`
                        const itemIcon = (
                          <i
                            className={`fas ${item.icon} w-4 text-center text-xs ${
                              active ? colors.text : "text-gray-400"
                            }`}
                          ></i>
                        )
                        if (item.action) {
                          const action = item.action
                          return (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => {
                                setMobileMenuOpen(false)
                                openAction(action)
                              }}
                              className={`${itemClass} w-full text-left`}
                            >
                              {itemIcon}
                              <span className="text-sm">{item.label}</span>
                            </button>
                          )
                        }
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={itemClass}
                          >
                            {itemIcon}
                            <span className="text-sm">{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
              <div className="bg-gray-50 px-3 py-1.5 border-t border-gray-100">
                <p className="text-[10px] text-gray-400">
                  Press{" "}
                  <kbd className="px-1 bg-gray-200 rounded text-[10px]">
                    Esc
                  </kbd>{" "}
                  to close
                </p>
              </div>
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

      {/* Desktop Navigation — hidden when unauthenticated */}
      {isAuthed && (
        <nav className="hidden lg:flex items-center ml-8 space-x-1">
          {navSections.map((section) => (
            <DesktopDropdown
              key={section.title}
              section={section}
              isAdmin={isAdmin}
              canRunAi={canRunAi}
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
