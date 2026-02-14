import { test, expect } from "@playwright/test"
import { PAGES } from "../../fixtures/test-data"

test.describe("Registration Flow", () => {
  test("should register user after Auth0 login @smoke", async ({ page }) => {
    // Navigate to home - this uses stored auth from auth.setup.ts
    await page.goto(PAGES.home)

    // Wait for registration to complete (RegistrationContext makes /api/register call)
    await page.waitForLoadState("domcontentloaded")

    // User should see welcome message after successful registration
    await expect(page.locator("h1")).toContainText("Welcome", {
      timeout: 15000,
    })

    // Should not show any registration errors
    const errorMessage = page.locator(
      ':text("Registration failed"), :text("Failed to connect")',
    )
    await expect(errorMessage).not.toBeVisible()
  })

  test("should call registration API on first load", async ({ page }) => {
    // Listen for the registration API call
    const registerPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/register") && response.status() === 200,
    )

    await page.goto(PAGES.home)

    // Verify registration API was called successfully
    const registerResponse = await registerPromise
    expect(registerResponse.status()).toBe(200)

    // Verify response contains user data
    const responseBody = await registerResponse.json()
    expect(responseBody.data).toBeDefined()
    expect(responseBody.data.email).toBeDefined()
  })

  test("should persist registration across page navigations", async ({
    page,
  }) => {
    // First load - triggers registration
    await page.goto(PAGES.home)
    await page.waitForLoadState("domcontentloaded")
    await expect(page.locator("h1")).toContainText("Welcome")

    // Navigate to another page
    await page.goto(PAGES.wealth)
    await page.waitForLoadState("domcontentloaded")

    // Should not redirect to login
    await expect(page).not.toHaveURL(/auth0\.com/)

    // Navigate back to home
    await page.goto(PAGES.home)
    await expect(page.locator("h1")).toContainText("Welcome")
  })

  test("should show main navigation sections after registration", async ({
    page,
  }) => {
    await page.goto(PAGES.home)
    await page.waitForLoadState("domcontentloaded")

    // Verify all three main sections are visible (use h2 headings)
    await expect(page.locator("h2").filter({ hasText: "Wealth" })).toBeVisible()
    await expect(page.locator("h2").filter({ hasText: "Invest" })).toBeVisible()
    await expect(
      page.locator("h2").filter({ hasText: "Independence" }),
    ).toBeVisible()
  })

  test("should access protected routes after registration", async ({
    page,
  }) => {
    await page.goto(PAGES.home)
    await page.waitForLoadState("domcontentloaded")

    // Test navigation to protected routes
    const protectedRoutes = [
      { url: PAGES.portfolios, name: "Portfolios" },
      { url: PAGES.wealth, name: "Wealth" },
      { url: "/settings", name: "Settings" },
    ]

    for (const route of protectedRoutes) {
      await page.goto(route.url)
      await page.waitForLoadState("domcontentloaded")

      // Should not redirect to Auth0
      await expect(page).not.toHaveURL(/auth0\.com/)

      // Should load page content
      await expect(page.locator("body")).toBeVisible()
    }
  })
})
