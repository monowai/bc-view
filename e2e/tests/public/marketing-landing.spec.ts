import { test, expect } from "@playwright/test"

/**
 * Logged-out marketing landing (src/pages/index.tsx → MarketingLanding).
 *
 * Runs in the `public` project: empty storageState, no auth-setup / health-check
 * dependency, so it needs only the Next dev server — no API stack or Auth0.
 * The landing only renders for signed-out visitors, which is why it lives here
 * rather than in the authed chromium/mobile projects.
 */
test.describe("Marketing landing (logged out) @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")
  })

  test("shows the hero and does not redirect to Auth0", async ({ page }) => {
    await expect(page).not.toHaveURL(/auth0\.com/)
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /your whole financial picture, kept honest/i,
      }),
    ).toBeVisible()
    // Illustrative disclaimer keeps the sample charts from reading as real data.
    await expect(
      page.getByText(/figures shown throughout are illustrative/i),
    ).toBeVisible()
    // Hero counterweight chart (desktop only).
    await expect(
      page.getByRole("img", { name: /net-worth chart climbing/i }),
    ).toBeVisible()
  })

  test("explains all three pillars with their questions and charts", async ({
    page,
  }) => {
    for (const heading of [
      /see everything you own/i,
      /work becomes optional/i,
      /a model you can hold to/i,
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible()
    }

    await expect(page.getByText("What do I have?")).toBeVisible()
    await expect(page.getByText("What do I want?")).toBeVisible()
    await expect(page.getByText("How do I get there?")).toBeVisible()

    // Charts are exposed as labelled images: 3 pillars + the hero chart (the
    // hero is visible at this project's desktop viewport). Scope to <main>;
    // dev-tools chrome can mount its own role=img elsewhere.
    const charts = page.getByRole("main").getByRole("img")
    await expect(charts).toHaveCount(4)
    await expect(
      page.getByRole("img", { name: /broker balances combining/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("img", { name: /work becomes optional/i }),
    ).toBeVisible()
    await expect(
      page.getByRole("img", { name: /illustrative target allocation/i }),
    ).toBeVisible()
  })

  test("routes the primary CTAs to the login flow", async ({ page }) => {
    // Scope to the landing <main> — the global app header also renders a
    // "Sign In" link, which would otherwise make these matches ambiguous.
    const main = page.getByRole("main")
    await expect(
      main.getByRole("link", { name: /^sign in$/i }),
    ).toHaveAttribute("href", "/auth/login")
    await expect(
      main.getByRole("link", { name: /get started/i }),
    ).toHaveAttribute("href", "/auth/login")
  })

  test("links each pillar to its learn page", async ({ page }) => {
    const learn = page.getByRole("link", { name: /learn more/i })
    await expect(learn).toHaveCount(3)
    await expect(learn.nth(0)).toHaveAttribute("href", "/learn/wealth")
    await expect(learn.nth(1)).toHaveAttribute("href", "/learn/independence")
    await expect(learn.nth(2)).toHaveAttribute("href", "/learn/strategy")
  })

  test("has no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")

    const hasHorizontalScroll = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(hasHorizontalScroll).toBe(false)
  })
})
