import { test, expect } from "@playwright/test"

/**
 * E2E test: Onboard a new user, create a CPF retirement account
 * with sub-account balances via the Independence wizard, and verify
 * the asset appears in Holdings.
 *
 * Also verifies that editing the plan preserves working expenses and
 * retirement expenses on first load (regression for useWatch race condition
 * where SWR-cached categories caused values to display as 0).
 *
 * Cleans up existing portfolios/plans before running so onboarding
 * starts fresh. No cleanup is performed afterwards so the result
 * can be reviewed.
 */
test.describe("CPF Onboarding Flow", () => {
  test("should onboard, create CPF with sub-accounts, and verify in holdings", async ({
    page,
  }) => {
    test.setTimeout(120_000)

    // ─── Pre-flight: Clean up existing data so onboarding is fresh ─

    await test.step("Clean up existing data for a fresh start", async () => {
      await page.goto("/")
      await page.waitForLoadState("domcontentloaded")

      // Delete all independence plans
      const plans = await page.evaluate(async () => {
        const res = await fetch("/api/independence/plans")
        if (!res.ok) return []
        const json = await res.json()
        return (json.data || []).map((p: { id: string }) => p.id)
      })
      for (const planId of plans) {
        await page.evaluate(
          (id) => fetch(`/api/independence/plans/${id}`, { method: "DELETE" }),
          planId,
        )
      }

      // Delete all user-owned assets (offboard endpoint removes assets + configs + transactions)
      await page.evaluate(async () => {
        await fetch("/api/offboard/assets", { method: "DELETE" })
      })

      // Delete all portfolios
      const portfolios = await page.evaluate(async () => {
        const res = await fetch("/api/portfolios")
        if (!res.ok) return []
        const json = await res.json()
        return (json.data || []).map((p: { id: string }) => p.id)
      })
      for (const pid of portfolios) {
        await page.evaluate(
          (id) => fetch(`/api/portfolios/${id}`, { method: "DELETE" }),
          pid,
        )
      }

      // Clear onboarding-complete flag and SWR cache so the app treats this as a new user
      await page.evaluate(() => {
        localStorage.removeItem("bc_onboarding_complete")
        // Clear SWR cache to avoid stale portfolio/asset data
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("swr-")) {
            localStorage.removeItem(key)
          }
        }
      })

      // Seed Independence settings (moved out of the plan wizard)
      await page.evaluate(async () => {
        await fetch("/api/independence/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yearOfBirth: 1980,
            targetIndependenceAge: 55,
            lifeExpectancy: 85,
          }),
        })
      })
    })

    // ─── Phase 1: Complete Onboarding Wizard ──────────────────────

    await test.step("Navigate to onboarding", async () => {
      await page.goto("/onboarding")
      await page.waitForLoadState("domcontentloaded")
      // Should see the welcome step
      await expect(page.getByText("Welcome to Beancounter")).toBeVisible({
        timeout: 15_000,
      })
    })

    await test.step("Step 1 - Welcome: enter name and continue", async () => {
      await page.locator("#preferredName").fill("E2E Tester")
      await page.getByRole("button", { name: "Continue" }).click()
    })

    await test.step("Step 2 - Currency: select SGD and continue", async () => {
      // Wait for currencies to load then click SGD button
      const sgdButton = page.locator("button").filter({ hasText: "SGD" })
      await expect(sgdButton.first()).toBeVisible({ timeout: 10_000 })
      await sgdButton.first().click()
      await page.getByRole("button", { name: "Continue" }).click()
      // Step 3 (Portfolio) is auto-skipped, lands on step 4
    })

    await test.step("Step 4 - Assets: skip for now", async () => {
      await expect(
        page.getByRole("button", { name: /skip for now/i }),
      ).toBeVisible({ timeout: 5_000 })
      await page.getByRole("button", { name: /skip for now/i }).click()
    })

    await test.step("Step 5 - Review: continue", async () => {
      const continueBtn = page.getByRole("button", { name: "Continue" })
      await expect(continueBtn).toBeVisible({ timeout: 5_000 })
      await continueBtn.click()
    })

    await test.step("Step 5 - Independence: skip", async () => {
      // Independence defaults ON; the CPF plan is created via the
      // independence wizard later in this test, so opt out here.
      await page.getByRole("button", { name: /skip for now/i }).click()
      await page.getByRole("button", { name: "Continue" }).click()
    })

    await test.step("Step 6 - Brokerage: complete setup", async () => {
      const completeBtn = page.getByRole("button", {
        name: /complete setup/i,
      })
      await expect(completeBtn).toBeVisible({ timeout: 5_000 })
      await completeBtn.click()
      // Wait for creation to finish and step 7 to appear
      await expect(page.getByRole("button", { name: /done/i })).toBeVisible({
        timeout: 30_000,
      })
    })

    await test.step("Step 7 - Complete: click Done", async () => {
      await page.getByRole("button", { name: /done/i }).click()
      // Should navigate to home page
      await page.waitForURL("/", { timeout: 10_000 })
      await page.waitForLoadState("domcontentloaded")
    })

    // ─── Phase 2: Independence Wizard - Create CPF Asset ──────────

    await test.step("Navigate to Independence wizard", async () => {
      await page.goto("/independence")
      await page.waitForLoadState("domcontentloaded")
      // Click "Create Your First Plan" or "Create Plan"
      const createLink = page.locator('a[href="/independence/wizard"]')
      await expect(createLink.first()).toBeVisible({ timeout: 10_000 })
      await createLink.first().click()
      await page.waitForURL(/\/independence\/wizard/, { timeout: 10_000 })
      await page.waitForLoadState("domcontentloaded")
    })

    await test.step("Independence Step 1 - Personal Info", async () => {
      await page.locator("#planName").fill("E2E CPF Plan")
      await page.locator("#expensesCurrency").selectOption("SGD")
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 2 - Assets: create CPF account", async () => {
      // Wait for Assets step to load
      const addButton = page.getByRole("button", {
        name: /add retirement account/i,
      })
      await expect(addButton).toBeVisible({ timeout: 10_000 })
      await addButton.click()

      // Fill account code
      await page
        .locator('input[placeholder*="short unique identifier"]')
        .fill("CPF")

      // Fill account name
      await page
        .locator('input[placeholder*="descriptive name"]')
        .fill("Central Provident Fund")

      // Select CPF policy type in the CompositeAssetEditor
      const policySelect = page
        .locator("select")
        .filter({ hasText: /none.*simple/i })
      await policySelect.selectOption("CPF")

      // CPF template auto-applies when the CPF policy type is selected —
      // sub-account rows render immediately with labelled balance inputs.
      await expect(page.getByLabel("OA balance")).toBeVisible({
        timeout: 5_000,
      })
      const balances: Array<[string, number]> = [
        ["OA balance", 50000],
        ["SA balance", 30000],
        ["MA balance", 20000],
        ["RA balance", 10000],
      ]
      for (const [label, value] of balances) {
        const input = page.getByLabel(label)
        if ((await input.count()) > 0) {
          await input.fill(String(value))
        }
      }

      // Select portfolio for balance transaction
      // Target the "Portfolio for Balance" dropdown specifically (last select on the form)
      const portfolioLabel = page.getByText("Portfolio for Balance")
      await expect(portfolioLabel).toBeVisible({ timeout: 5_000 })
      const portfolioDropdown = portfolioLabel.locator("..").locator("select")
      await expect(portfolioDropdown).toBeVisible()
      // Select the SGD portfolio option
      const options = await portfolioDropdown
        .locator("option")
        .allTextContents()
      const sgdOption = options.find((o) => o.includes("SGD"))
      if (sgdOption) {
        await portfolioDropdown.selectOption({ label: sgdOption })
      }

      // Click Create Retirement Account
      const createBtn = page.getByRole("button", {
        name: /create retirement account/i,
      })
      await expect(createBtn).toBeVisible()
      await createBtn.click()

      // Wait for creation to complete (spinner goes away)
      await expect(createBtn).not.toBeVisible({ timeout: 30_000 })

      // Proceed to next step
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Steps 3-4: advance through", async () => {
      // Step 3 - Assumptions
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()

      // Step 4 - Income
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 5 - Retirement Expenses: enter values", async () => {
      // Wait for system categories to load
      const expenseInputs = page.locator('input[min="0"][step="50"]')
      await expect(expenseInputs.first()).toBeVisible({ timeout: 10_000 })

      // Fill first category with known value
      await expenseInputs.nth(0).fill("2000")

      // Verify total updates
      await expect(page.getByText("$2,000")).toBeVisible({ timeout: 5_000 })

      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 6 - Life Events: save plan", async () => {
      const saveBtn = page.getByRole("button", { name: /save plan/i })
      await expect(saveBtn).toBeVisible({ timeout: 5_000 })
      await saveBtn.click()

      // Should navigate to the plan view page
      await page.waitForURL(/\/independence\/plans\//, { timeout: 30_000 })
    })

    // ─── Phase 3: Verify CPF in Holdings ──────────────────────────

    await test.step("Verify CPF asset appears in Holdings", async () => {
      // Trigger a fresh valuation via API
      await page.evaluate(async () => {
        await fetch("/api/holdings/SGD?asAt=today")
      })

      // Open holdings in a new tab to bypass SWR in-memory cache
      const newPage = await page.context().newPage()
      await newPage.goto("/holdings/SGD")
      await newPage.waitForLoadState("domcontentloaded")

      // Verify holdings loaded with the correct total and currency is SGD
      await expect(newPage.getByText("110,000.00").first()).toBeVisible({
        timeout: 15_000,
      })
      await expect(newPage.getByText("SGD").first()).toBeVisible()

      // Card view groups by Asset Class; retirement policies now group under
      // "Retirement Fund" (formerly "Policies") and start collapsed — expand
      // to reveal the CPF asset card.
      const group = newPage.getByRole("button", { name: /Retirement Fund/ })
      await expect(group.first()).toBeVisible()
      await group.first().click()

      // Verify the CPF asset name appears
      await expect(newPage.getByText("Central Provident Fund")).toBeVisible({
        timeout: 10_000,
      })

      await newPage.close()
    })

    // ─── Phase 4: Edit plan and verify expense values preserved ──

    await test.step("Edit plan — verify retirement expenses preserved on first load", async () => {
      // Extract plan ID from current URL (/independence/plans/{planId})
      const planId = page.url().split("/").pop()
      expect(planId).toBeTruthy()

      // Navigate to edit wizard (fresh page load to simulate real edit flow)
      await page.goto(`/independence/wizard/${planId}`)
      await page.waitForLoadState("domcontentloaded")

      // Wait for the edit wizard to fully load (plan data fetched via SWR).
      // Heading format is now "Edit {plan.name} Plan".
      await expect(
        page.getByRole("heading", { name: /^edit .* plan$/i }),
      ).toBeVisible({ timeout: 15_000 })

      // In edit mode, step indicators are clickable buttons.
      // Navigate to Step 5 (Expenses) — 0-indexed: nth(4).
      const stepButtons = page.locator(
        'nav[aria-label="Progress"] li [role="button"]',
      )
      await stepButtons.nth(4).click()

      // Wait for expense category inputs to appear.
      const retExpInputs = page.locator('input[min="0"][step="50"]')
      await expect(retExpInputs.first()).toBeVisible({ timeout: 10_000 })

      // Saved expense values hydrate asynchronously (plan + expenses endpoints
      // are separate). On slower runners the saved category may not be the
      // first input, so assert that SOME input carries the saved amount, and
      // that the total reflects the saved value.
      // Expense inputs are MathInputs (no name attribute; controlled value) —
      // poll until some input carries the saved amount.
      await expect
        .poll(
          () =>
            page
              .locator('input[min="0"][step="50"]')
              .evaluateAll((els) =>
                els.some((el) => (el as HTMLInputElement).value === "2000"),
              ),
          { timeout: 10_000 },
        )
        .toBe(true)
      await expect(page.getByText("$2,000")).toBeVisible({ timeout: 5_000 })
    })
  })
})
