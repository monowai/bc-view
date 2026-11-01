import { expect, Page } from "@playwright/test"

// Unique prefix for E2E test data to enable cleanup
const E2E_PREFIX = "E2E"

// Generate unique short code (max 6 chars) for portfolio codes
// Format: E2Exxx where xxx is 3 random alphanumeric chars
export function generateTestId(): string {
  return `${E2E_PREFIX}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

// Generate a longer unique identifier for names/descriptions
export function generateTestName(): string {
  return `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export interface TestPortfolio {
  id: string
  code: string
  name: string
  currency: string
  base: string
}

export interface TestHelpers {
  createPortfolio: (
    name?: string,
    currency?: string,
    base?: string,
  ) => Promise<TestPortfolio>
  deletePortfolio: (id: string) => Promise<void>
  /**
   * Delete every broker whose name starts with the given prefix
   * (defaults to "E2E"). Used after the Open Brokerage wizard runs;
   * the wizard creates a broker but doesn't expose its id to the spec,
   * so we sweep by name prefix instead.
   */
  cleanupBrokersByPrefix: (prefix?: string) => Promise<void>
  cleanupTestData: () => Promise<void>
}

/**
 * Ensure page is on the app domain before making API calls
 */
async function ensureAppDomain(page: Page): Promise<void> {
  const url = page.url()
  // If page is on about:blank or different domain, navigate to home
  if (!url || url === "about:blank" || !url.includes("localhost:3000")) {
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")
  }
}

/**
 * Delete every independence plan the user owns: stages, then the journeys that
 * hold them. A journey left behind reads as an existing plan, and onboarding
 * refuses to start another over it.
 */
export async function deleteIndependencePlans(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const collection of ["plans", "independence-plans"]) {
      const res = await fetch(`/api/independence/${collection}`)
      if (!res.ok) throw new Error(`GET ${collection}: ${res.status}`)
      const json = await res.json()
      for (const { id } of json.data || []) {
        const del = await fetch(`/api/independence/${collection}/${id}`, {
          method: "DELETE",
        })
        if (!del.ok) throw new Error(`DELETE ${collection}: ${del.status}`)
      }
    }
  })
}

/**
 * Create a CPF policy on the account form and link it to a portfolio. CPF
 * LIFE defaults to Standard. Linking prompts only when the user holds more
 * than one portfolio.
 */
export async function createCpfAccount(
  page: Page,
  account: {
    name: string
    portfolio: string
    balances: Record<"OA" | "SA" | "MA" | "RA", number>
  },
): Promise<void> {
  await page.goto("/assets/account?category=POLICY")
  await page.waitForLoadState("domcontentloaded")

  const policySelect = page
    .locator("select")
    .filter({ hasText: /none.*simple/i })
  await expect(policySelect).toBeVisible({ timeout: 15000 })

  await page.locator('input[name="code"]').fill("CPF")
  await page.locator('input[name="name"]').fill(account.name)
  // Currency defaults to the base chosen during onboarding
  await expect(page.getByText("SGD", { exact: true }).first()).toBeVisible()

  await policySelect.selectOption("CPF")
  for (const [subAccount, balance] of Object.entries(account.balances)) {
    await page.getByLabel(`${subAccount} balance`).fill(String(balance))
  }

  await page.getByRole("button", { name: "Submit", exact: true }).click()

  const accountsUrl = /\/accounts/
  const prompt = page.getByText("Which portfolio do you want to add this to?")
  await expect(
    prompt.or(page.getByRole("heading", { name: /account/i })).first(),
  ).toBeVisible({ timeout: 30000 })
  if (await prompt.isVisible()) {
    await page
      .getByRole("button", { name: new RegExp(account.portfolio) })
      .first()
      .click()
  }
  await page.waitForURL(accountsUrl, { timeout: 30000 })
}

/**
 * The page rendered something a user can read. Asserts structure, not wording,
 * so copy changes and the empty/populated variants of a page both pass.
 */
export async function expectPageContent(page: Page): Promise<void> {
  await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 })
}

/**
 * Create test data helpers using browser-based fetch (inherits auth cookies)
 */
export function createTestHelpers(page: Page): TestHelpers {
  const createdPortfolios: string[] = []

  return {
    async createPortfolio(
      name?: string,
      currency = "USD",
      base = "USD",
    ): Promise<TestPortfolio> {
      // Ensure page is on app domain for API calls
      await ensureAppDomain(page)

      const testId = generateTestId()
      const portfolioName = name || `Test Portfolio ${testId}`
      const code = testId

      // Use page.evaluate to make fetch request from within browser context
      // This ensures auth cookies are properly included
      // Backend expects PortfoliosRequest with data array
      const result = await page.evaluate(
        async ({ code, name, currency, base }) => {
          const response = await fetch("/api/portfolios", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: [{ code, name, currency, base }],
            }),
          })
          const text = await response.text()
          return {
            ok: response.ok,
            status: response.status,
            body: text,
          }
        },
        { code, name: portfolioName, currency, base },
      )

      if (!result.ok) {
        throw new Error(
          `Failed to create portfolio: ${result.status} ${result.body}`,
        )
      }

      const parsed = JSON.parse(result.body)
      // Backend returns PortfoliosResponse with data array
      const portfolio = parsed.data[0]
      createdPortfolios.push(portfolio.id)

      return {
        id: portfolio.id,
        code: portfolio.code,
        name: portfolio.name,
        currency: portfolio.currency.code,
        base: portfolio.base.code,
      }
    },

    async deletePortfolio(id: string): Promise<void> {
      // Ensure page is on app domain for API calls
      await ensureAppDomain(page)

      const result = await page.evaluate(async (portfolioId) => {
        const response = await fetch(`/api/portfolios/${portfolioId}`, {
          method: "DELETE",
        })
        return { ok: response.ok, status: response.status }
      }, id)

      if (!result.ok && result.status !== 404) {
        console.warn(`Failed to delete portfolio ${id}: ${result.status}`)
      }
    },

    async cleanupBrokersByPrefix(prefix = "E2E"): Promise<void> {
      await ensureAppDomain(page)
      try {
        const result = await page.evaluate(async () => {
          const r = await fetch("/api/brokers")
          if (!r.ok) return { ok: false, brokers: [] }
          const j = await r.json()
          return {
            ok: true,
            brokers: (j.data ?? []) as Array<{ id: string; name: string }>,
          }
        })
        if (!result.ok) return
        for (const b of result.brokers) {
          if (b.name?.startsWith(prefix)) {
            await page.evaluate(async (brokerId) => {
              await fetch(`/api/brokers/${brokerId}`, { method: "DELETE" })
            }, b.id)
          }
        }
      } catch (e) {
        console.warn("Failed to cleanup brokers:", e)
      }
    },

    async cleanupTestData(): Promise<void> {
      // Ensure page is on app domain for API calls
      await ensureAppDomain(page)

      // Delete all created portfolios
      for (const id of createdPortfolios) {
        try {
          await this.deletePortfolio(id)
        } catch (e) {
          console.warn(`Failed to cleanup portfolio ${id}:`, e)
        }
      }
      createdPortfolios.length = 0

      // Clean up any orphaned E2E test data
      try {
        const result = await page.evaluate(async () => {
          const response = await fetch("/api/portfolios")
          if (!response.ok) return { ok: false, portfolios: [] }
          const json = await response.json()
          return { ok: true, portfolios: json.data || [] }
        })

        if (result.ok) {
          for (const portfolio of result.portfolios) {
            // Check for both E2E and E2E- prefixes (legacy and new format)
            if (portfolio.code?.startsWith("E2E")) {
              await this.deletePortfolio(portfolio.id)
            }
          }
        }
      } catch (e) {
        console.warn("Failed to cleanup orphaned E2E data:", e)
      }
    },
  }
}

/**
 * Poll the holdings API until bc-position can resolve the portfolio.
 * This addresses a race condition where bc-data has committed the portfolio
 * but bc-position hasn't yet seen it.
 */
export async function waitForHoldings(
  page: Page,
  portfolioCode: string,
  { maxAttempts = 10, intervalMs = 500 } = {},
): Promise<void> {
  await ensureAppDomain(page)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ok = await page.evaluate(async (code) => {
      const response = await fetch(`/api/holdings/${code}?asAt=today`)
      return response.ok
    }, portfolioCode)

    if (ok) return

    if (attempt < maxAttempts) {
      await page.waitForTimeout(intervalMs)
    }
  }
  // Don't throw — let the test proceed and fail with a meaningful UI error
  // if the backend is still not ready after all attempts
}

// Sample portfolio data for tests
export const SAMPLE_PORTFOLIOS = {
  growth: {
    name: "E2E-Growth Portfolio",
    currency: "USD",
    base: "USD",
  },
  income: {
    name: "E2E-Income Portfolio",
    currency: "NZD",
    base: "NZD",
  },
  multiCurrency: {
    name: "E2E-Multi Currency",
    currency: "GBP",
    base: "NZD",
  },
}

// Sample transaction CSV content
// Page URLs for navigation
export const PAGES = {
  home: "/",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  portfolios: "/portfolios",
  portfolio: (id: string) => `/portfolios/${id}`, // Uses portfolio ID
  newPortfolio: "/portfolios/__NEW__",
  holdings: (code: string) => `/holdings/${code}`, // Uses portfolio CODE
  wealth: "/wealth",
  independence: "/independence",
  rebalance: "/rebalance/models",
} as const

// CSS selectors for common elements
export const SELECTORS = {
  // Navigation
  navbar: "nav",
  userMenu: "[data-testid='user-menu']",

  // Portfolio
  portfolioList: "[data-testid='portfolio-list']",
  portfolioCard: "[data-testid='portfolio-card']",
  createPortfolioBtn: "[data-testid='create-portfolio']",
  portfolioForm: "form",

  // Holdings
  holdingsTable: "[data-testid='holdings-table']",
  holdingRow: "[data-testid='holding-row']",
  viewToggle: "[data-testid='view-toggle']",

  // Common
  loadingSpinner: ".animate-spin",
  errorMessage: "[data-testid='error-message']",
  successMessage: "[data-testid='success-message']",
  submitBtn: "button[type='submit']",
} as const
