import { test, expect } from "@playwright/test"

/**
 * E2E test: Onboard a new user, create a CPF retirement account
 * with sub-account balances via the Independence wizard, and verify
 * the asset appears in Holdings.
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
      await page.waitForLoadState("networkidle")

      // Delete all independence plans
      const plans = await page.evaluate(async () => {
        const res = await fetch("/api/independence/plans")
        if (!res.ok) return []
        const json = await res.json()
        return (json.data || []).map((p: { id: string }) => p.id)
      })
      for (const planId of plans) {
        await page.evaluate(
          (id) =>
            fetch(`/api/independence/plans/${id}`, { method: "DELETE" }),
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
          (id) =>
            fetch(`/api/portfolios/${id}`, { method: "DELETE" }),
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
    })

    // ─── Phase 1: Complete Onboarding Wizard ──────────────────────

    await test.step("Navigate to onboarding", async () => {
      await page.goto("/onboarding")
      await page.waitForLoadState("networkidle")
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

    await test.step("Step 5 - Review: complete setup", async () => {
      const completeBtn = page.getByRole("button", {
        name: /complete setup/i,
      })
      await expect(completeBtn).toBeVisible({ timeout: 5_000 })
      await completeBtn.click()
      // Wait for creation to finish and step 6 to appear
      await expect(page.getByRole("button", { name: /done/i })).toBeVisible({
        timeout: 30_000,
      })
    })

    await test.step("Step 6 - Complete: click Done", async () => {
      await page.getByRole("button", { name: /done/i }).click()
      // Should navigate to home page
      await page.waitForURL("/", { timeout: 10_000 })
      await page.waitForLoadState("networkidle")
    })

    // ─── Phase 2: Independence Wizard - Create CPF Asset ──────────

    await test.step("Navigate to Independence wizard", async () => {
      await page.goto("/independence")
      await page.waitForLoadState("networkidle")
      // Click "Create Your First Plan" or "Create Plan"
      const createLink = page.getByRole("link", { name: /create.*plan/i })
      await expect(createLink.first()).toBeVisible({ timeout: 10_000 })
      await createLink.first().click()
      await page.waitForURL(/\/independence\/wizard/, { timeout: 10_000 })
      await page.waitForLoadState("networkidle")
    })

    await test.step("Independence Step 1 - Personal Info", async () => {
      await page.locator("#planName").fill("E2E CPF Plan")
      await page.locator("#expensesCurrency").selectOption("SGD")
      await page.locator("#yearOfBirth").fill("1980")
      await page.locator("#targetRetirementAge").fill("55")
      await page.locator("#lifeExpectancy").fill("85")
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 2 - Working Expenses: skip", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 3 - Contributions: skip", async () => {
      // Wait for the step to render
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 4 - Assets: create CPF account", async () => {
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

      // Apply CPF template
      const applyTemplate = page.getByRole("button", {
        name: /apply cpf template/i,
      })
      await expect(applyTemplate).toBeVisible({ timeout: 5_000 })
      await applyTemplate.click()

      // Fill sub-account balances (OA, SA, MA, RA)
      // The sub-accounts table has rows with code labels and balance inputs
      const balanceInputs = page.locator(
        'table input[type="number"][step="100"]',
      )
      await expect(balanceInputs.first()).toBeVisible({ timeout: 5_000 })

      // OA = 50000, SA = 30000, MA = 20000, RA = 10000
      const balances = [50000, 30000, 20000, 10000]
      const count = await balanceInputs.count()
      for (let i = 0; i < Math.min(count, balances.length); i++) {
        await balanceInputs.nth(i).fill(String(balances[i]))
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

    await test.step("Independence Steps 5-7: advance through", async () => {
      // Step 5 - Assumptions
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()

      // Step 6 - Income
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()

      // Step 7 - Expenses
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 8 - Life Events: save plan", async () => {
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
      await newPage.waitForLoadState("networkidle")

      // Verify holdings loaded with the correct total and currency is SGD
      await expect(newPage.getByText("110,000.00").first()).toBeVisible({
        timeout: 15_000,
      })
      await expect(newPage.getByText("SGD").first()).toBeVisible()

      // Default card view groups by Asset Class — expand to see individual assets
      const retirementGroup = newPage.getByText("Retirement Fund")
      await expect(retirementGroup.first()).toBeVisible()
      await retirementGroup.first().click()

      // Verify the CPF asset name appears
      await expect(newPage.getByText("Central Provident Fund")).toBeVisible({
        timeout: 10_000,
      })

      await newPage.close()
    })
  })
})
