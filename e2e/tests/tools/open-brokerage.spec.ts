import { test, expect } from "@playwright/test"
import { createTestHelpers, generateTestId } from "../../fixtures/test-data"

test.describe("/tools/open-brokerage", () => {
  test("renders wizard at the Broker step", async ({ page }) => {
    await page.goto("/tools/open-brokerage")
    await expect(page.getByRole("heading", { name: /^Broker$/i })).toBeVisible()
    await expect(page.getByText(/Step 1 of 4/i)).toBeVisible()
  })

  // Note: the onboarding-link click-through test was removed when the
  // brokerage CTA moved from WelcomeStep (step 1) to CompleteStep (final
  // step). Reaching it from /onboarding now requires walking the entire
  // wizard — too expensive for this spec. A direct /tools/open-brokerage
  // smoke test covers the destination; CompleteStep itself is verified
  // by jest renders rather than the browser.

  test("creates a broker + portfolio with no funding @smoke", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)
    const testId = generateTestId() // E2Exxx — 6 chars
    const brokerName = `E2E Broker ${testId}`

    try {
      // Land on home first to settle auth context
      await page.goto("/")
      await page.waitForLoadState("domcontentloaded")

      // Two seeded portfolios force master mode: zen users (≤1 portfolio)
      // get an auto-fold on step 2 with no create-new chooser at all.
      await helpers.createPortfolio(`E2E Seed A ${testId}`, "USD", "USD")
      await helpers.createPortfolio(`E2E Seed B ${testId}`, "USD", "USD")

      await page.goto("/tools/open-brokerage")
      await page.waitForLoadState("domcontentloaded")

      // Step 1 — Broker
      await expect(
        page.getByRole("heading", { name: /^Broker$/i }),
      ).toBeVisible()
      await page.getByLabel(/Broker name/i).fill(brokerName)
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 2 — Portfolio: mode defaults to "attach to existing"; this test
      // exercises the create-new path. Name/code are derived from the broker
      // name — grab the code shown as "(code XXX)" for the API check later.
      await expect(
        page.getByRole("heading", { name: /^Portfolio$/i }),
      ).toBeVisible()
      await page.getByRole("radio", { name: /create a new portfolio/i }).check()
      const codeNote = await page
        .getByText(/\(code [A-Z0-9-]+\)/)
        .first()
        .textContent()
      const derivedCode = /\(code ([A-Z0-9-]+)\)/.exec(codeNote ?? "")?.[1]
      expect(derivedCode).toBeTruthy()
      // Currency defaults to USD
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 3 — Funding: skip
      await expect(
        page.getByRole("heading", { name: /Funding|Deposit/i }),
      ).toBeVisible()
      await page.getByRole("button", { name: /Skip|No deposit/i }).click()

      // Step 4 — Review
      await expect(
        page.getByRole("heading", { name: /^Review$/i }),
      ).toBeVisible()
      await expect(page.getByText(brokerName).first()).toBeVisible()

      await page
        .getByRole("button", { name: /Create|Confirm|Open Brokerage/i })
        .click()

      // Done screen
      await expect(
        page.getByRole("heading", { name: /Done|Complete|Success/i }),
      ).toBeVisible({ timeout: 15000 })

      // Verify the derived portfolio persisted, then remove it (the wizard
      // created it outside the helpers' cleanup registry).
      const result = await page.evaluate(async (code) => {
        const r = await fetch("/api/portfolios")
        if (!r.ok) return null
        const j = await r.json()
        return (
          j.data?.find((p: { code: string; id: string }) => p.code === code) ??
          null
        )
      }, derivedCode)
      expect(result).not.toBeNull()
      await page.evaluate(
        (id) => fetch(`/api/portfolios/${id}`, { method: "DELETE" }),
        result.id,
      )
    } finally {
      await helpers.cleanupTestData()
      // Wizard creates a broker that cleanupTestData doesn't know about.
      // Sweep by name prefix so it doesn't leak between runs.
      await helpers.cleanupBrokersByPrefix("E2E")
    }
  })

  test("creates a broker + portfolio + USD cash account with opening deposit @smoke", async ({
    page,
  }) => {
    const helpers = createTestHelpers(page)

    try {
      const testId = generateTestId()
      const brokerName = `E2E Broker ${testId}`

      // Two seeded portfolios force master mode so the create-new chooser
      // shows (zen users with ≤1 portfolio get the auto-fold path).
      await helpers.createPortfolio(`E2E Seed A ${testId}`, "USD", "USD")
      await helpers.createPortfolio(`E2E Seed B ${testId}`, "USD", "USD")

      await page.goto("/tools/open-brokerage")
      await page.waitForLoadState("domcontentloaded")

      // Step 1 — Broker
      await page.getByLabel(/Broker name/i).fill(brokerName)
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 2 — Portfolio (USD): create-new; name/code derive from broker name
      await page.getByRole("radio", { name: /create a new portfolio/i }).check()
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 3 — Funding: add a USD account with an opening deposit.
      // (The old source-portfolio WITHDRAWAL leg is gone from this wizard —
      // funding is a standalone per-currency opening DEPOSIT.)
      await expect(
        page.getByRole("heading", { name: /Funding/i }),
      ).toBeVisible()
      await page
        .getByLabel(/Add (a|another) currency account/i)
        .selectOption("USD")
      await page.getByLabel(/Opening deposit \(USD\)/i).fill("2500")
      await page.getByRole("button", { name: "Next →" }).click()

      // Step 4 — Review + submit
      await expect(
        page.getByRole("heading", { name: /^Review$/i }),
      ).toBeVisible()
      await page
        .getByRole("button", { name: /Create|Confirm|Open Brokerage/i })
        .click()

      await expect(
        page.getByRole("heading", { name: /Done|Complete|Success/i }),
      ).toBeVisible({ timeout: 20000 })

      // The Done screen reports the posted opening DEPOSIT
      await expect(page.getByText(/1\s+cash transaction/i)).toBeVisible()
    } finally {
      await helpers.cleanupTestData()
      // Wizard creates a broker that cleanupTestData doesn't know about.
      // Sweep by name prefix so it doesn't leak between runs.
      await helpers.cleanupBrokersByPrefix("E2E")
    }
  })
})
