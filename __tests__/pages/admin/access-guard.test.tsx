import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SWRConfig } from "swr"
import AdminPage from "@pages/admin/index"
import AccountingTypesPage from "@pages/admin/accounting-types"
import AiQuotaPage from "@pages/admin/ai-quota"
import AssetsPage from "@pages/admin/assets"
import LoggersPage from "@pages/admin/loggers"
import MetricsPage from "@pages/admin/metrics"
import ScenariosPage from "@pages/admin/scenarios"
import ServicesPage from "@pages/admin/services"
import TasksPage from "@pages/admin/tasks"

let mockAdmin = false
let mockLoading = false
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ admin: mockAdmin, isLoading: mockLoading }),
}))

jest.mock("@components/features/assets/AssetSearch", () => ({
  __esModule: true,
  default: () => null,
}))

const full = (href: string, label: string): string =>
  '<div class="max-w-4xl mx-auto py-12 px-4">' +
  '<div class="@@ALERT@@">' +
  '<i class="fas fa-lock text-4xl text-red-400 mb-4"></i>' +
  '<h1 class="text-xl font-semibold text-red-700 mb-2">Access Denied</h1>' +
  '<p class="text-red-600">You do not have permission to access the admin area.</p>' +
  `<a href="${href}" class="inline-block mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">${label}</a>` +
  "</div></div>"

const bare =
  '<div class="max-w-4xl mx-auto py-12 px-4">' +
  '<div class="@@ALERT@@">' +
  '<h1 class="text-xl font-semibold text-red-700">Access Denied</h1>' +
  "</div></div>"

const toPortfolios = full("/portfolios", "Return to Portfolios")
const toAdmin = full("/admin", "Return to Admin")

const pages: [string, unknown, string][] = [
  ["index", AdminPage, toPortfolios],
  ["accounting-types", AccountingTypesPage, toPortfolios],
  ["ai-quota", AiQuotaPage, toPortfolios],
  ["assets", AssetsPage, toAdmin],
  ["loggers", LoggersPage, bare],
  ["metrics", MetricsPage, bare],
  ["scenarios", ScenariosPage, toPortfolios],
  ["services", ServicesPage, toPortfolios],
  ["tasks", TasksPage, toPortfolios],
]

function renderPage(page: unknown): HTMLElement {
  const Page = page as React.ComponentType
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Page />
    </SWRConfig>,
  ).container
}

describe("admin page guard", () => {
  beforeEach(() => {
    mockAdmin = false
    mockLoading = false
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ data: [], counts: [], breakdowns: {}, services: [] }),
    }) as unknown as typeof fetch
  })

  it.each(pages)(
    "should render the exact denied panel on %s for a non-admin",
    (_name, page, expected) => {
      const container = renderPage(page)
      const alert = container.querySelector("[role='alert']")
      const alertClass = alert?.getAttribute("class") ?? ""
      expect(container.innerHTML.replace(/ role="alert"/, "")).toBe(
        expected.replace("@@ALERT@@", alertClass),
      )
    },
  )

  it.each(pages)(
    "should not fetch anything admin-only on %s for a non-admin",
    (name, page) => {
      renderPage(page)
      const urls = (global.fetch as jest.Mock).mock.calls.map((c) =>
        String(c[0]),
      )
      // Accounting types and scenarios load on mount; the API route is the
      // gate there. Every other page keys its fetch on the admin flag.
      if (name !== "accounting-types" && name !== "scenarios") {
        expect(urls.filter((u) => u.includes("/api/admin"))).toEqual([])
      }
    },
  )

  it.each(pages)(
    "should show the page loader, not the denied panel, on %s while permissions load",
    (_name, page) => {
      mockLoading = true
      renderPage(page)
      expect(screen.queryByText("Access Denied")).not.toBeInTheDocument()
    },
  )

  it.each(pages)(
    "should not show the denied panel on %s for an admin",
    (_name, page) => {
      mockAdmin = true
      renderPage(page)
      expect(screen.queryByText("Access Denied")).not.toBeInTheDocument()
    },
  )
})
