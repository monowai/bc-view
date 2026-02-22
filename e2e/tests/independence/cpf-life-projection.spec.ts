import { test, expect } from "@playwright/test"

/**
 * E2E test: Create an independence plan with a CPF asset configured
 * for CPF LIFE (Standard plan), then verify the backend calculates
 * monthly payouts that appear in the Income Breakdown table as
 * "Private Pension" income at the configured payout age.
 *
 * Flow:
 *   1. Clean existing data, complete onboarding
 *   2. Create independence plan with CPF asset + CPF LIFE Standard plan
 *   3. Navigate to plan view → "My Path" tab
 *   4. Expand "Income Breakdown" section
 *   5. Verify "Private Pension" column appears with non-zero values
 */
test.describe("CPF LIFE Projection Flow", () => {
  test("should show CPF LIFE payouts as Private Pension in Income Breakdown", async ({
    page,
  }) => {
    test.setTimeout(150_000)

    // ─── Phase 1: Clean up existing data ────────────────────────

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

      // Delete all user-owned assets
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

      // Clear onboarding flag and SWR cache
      await page.evaluate(() => {
        localStorage.removeItem("bc_onboarding_complete")
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("swr-")) {
            localStorage.removeItem(key)
          }
        }
      })
    })

    // ─── Phase 2: Complete Onboarding Wizard ────────────────────

    await test.step("Complete onboarding", async () => {
      await page.goto("/onboarding")
      await page.waitForLoadState("domcontentloaded")
      await expect(page.getByText("Welcome to Beancounter")).toBeVisible({
        timeout: 15_000,
      })

      // Step 1 - Welcome
      await page.locator("#preferredName").fill("CPF LIFE Tester")
      await page.getByRole("button", { name: "Continue" }).click()

      // Step 2 - Currency: select SGD
      const sgdButton = page.locator("button").filter({ hasText: "SGD" })
      await expect(sgdButton.first()).toBeVisible({ timeout: 10_000 })
      await sgdButton.first().click()
      await page.getByRole("button", { name: "Continue" }).click()

      // Step 4 - Assets: skip
      await expect(
        page.getByRole("button", { name: /skip for now/i }),
      ).toBeVisible({ timeout: 5_000 })
      await page.getByRole("button", { name: /skip for now/i }).click()

      // Step 5 - Review: continue
      const continueBtn = page.getByRole("button", { name: "Continue" })
      await expect(continueBtn).toBeVisible({ timeout: 5_000 })
      await continueBtn.click()

      // Step 6 - Independence: complete setup
      const completeBtn = page.getByRole("button", {
        name: /complete setup/i,
      })
      await expect(completeBtn).toBeVisible({ timeout: 5_000 })
      await completeBtn.click()
      await expect(page.getByRole("button", { name: /done/i })).toBeVisible({
        timeout: 30_000,
      })

      // Step 7 - Done
      await page.getByRole("button", { name: /done/i }).click()
      await page.waitForURL("/", { timeout: 10_000 })
    })

    // ─── Phase 3: Independence Wizard - Create CPF with CPF LIFE ─

    await test.step("Navigate to Independence wizard", async () => {
      await page.goto("/independence")
      await page.waitForLoadState("domcontentloaded")
      const createLink = page.getByRole("link", { name: /create.*plan/i })
      await expect(createLink.first()).toBeVisible({ timeout: 10_000 })
      await createLink.first().click()
      await page.waitForURL(/\/independence\/wizard/, { timeout: 10_000 })
      await page.waitForLoadState("domcontentloaded")
    })

    await test.step("Step 1 - Personal Info", async () => {
      await page.locator("#planName").fill("CPF LIFE Test Plan")
      await page.locator("#expensesCurrency").selectOption("SGD")
      // Born 1980 → current age 46, retirement at 55
      await page.locator("#yearOfBirth").fill("1980")
      await page.locator("#targetRetirementAge").fill("55")
      await page.locator("#lifeExpectancy").fill("85")
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Step 2 - Working Expenses", async () => {
      const expenseInputs = page.locator(
        'input[type="number"][min="0"][step="50"]',
      )
      await expect(expenseInputs.first()).toBeVisible({ timeout: 10_000 })
      await expenseInputs.nth(0).fill("500")
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Step 3 - Contributions: skip", async () => {
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Step 4 - Assets: create CPF with CPF LIFE Standard", async () => {
      const addButton = page.getByRole("button", {
        name: /add retirement account/i,
      })
      await expect(addButton).toBeVisible({ timeout: 10_000 })
      await addButton.click()

      // Fill account code and name
      await page
        .locator('input[placeholder*="short unique identifier"]')
        .fill("CPF")
      await page
        .locator('input[placeholder*="descriptive name"]')
        .fill("CPF LIFE Test Account")

      // Select CPF policy type
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

      // Set CPF LIFE Plan to Standard
      const cpfLifeSection = page.getByText("CPF LIFE Settings")
      await expect(cpfLifeSection).toBeVisible({ timeout: 5_000 })

      // Find the CPF LIFE Plan dropdown (inside the CPF LIFE Settings section)
      const cpfLifePlanSelect = page
        .locator("select")
        .filter({ hasText: /not set/i })
      await cpfLifePlanSelect.selectOption("STANDARD")

      // Fill sub-account balances: OA=50000, SA=80000, MA=20000, RA=0
      // Use higher SA balance to get meaningful RA at 55 and visible payouts
      const balanceInputs = page.locator(
        'table input[type="number"][step="100"]',
      )
      await expect(balanceInputs.first()).toBeVisible({ timeout: 5_000 })

      const balances = [50000, 80000, 20000, 0]
      const count = await balanceInputs.count()
      for (let i = 0; i < Math.min(count, balances.length); i++) {
        await balanceInputs.nth(i).fill(String(balances[i]))
      }

      // Select portfolio for balance transaction
      const portfolioLabel = page.getByText("Portfolio for Balance")
      await expect(portfolioLabel).toBeVisible({ timeout: 5_000 })
      const portfolioDropdown = portfolioLabel.locator("..").locator("select")
      await expect(portfolioDropdown).toBeVisible()
      const options = await portfolioDropdown
        .locator("option")
        .allTextContents()
      const sgdOption = options.find((o) => o.includes("SGD"))
      if (sgdOption) {
        await portfolioDropdown.selectOption({ label: sgdOption })
      }

      // Create the account
      const createBtn = page.getByRole("button", {
        name: /create retirement account/i,
      })
      await expect(createBtn).toBeVisible()
      await createBtn.click()
      await expect(createBtn).not.toBeVisible({ timeout: 30_000 })

      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Steps 5-6: Assumptions and Income", async () => {
      // Step 5 - Assumptions
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()

      // Step 6 - Income
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Step 7 - Retirement Expenses", async () => {
      const expenseInputs = page.locator(
        'input[type="number"][min="0"][step="50"]',
      )
      await expect(expenseInputs.first()).toBeVisible({ timeout: 10_000 })
      await expenseInputs.nth(0).fill("1500")
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Step 8 - Save plan", async () => {
      const saveBtn = page.getByRole("button", { name: /save plan/i })
      await expect(saveBtn).toBeVisible({ timeout: 5_000 })
      await saveBtn.click()
      await page.waitForURL(/\/independence\/plans\//, { timeout: 30_000 })
    })

    // ─── Phase 4: Verify CPF LIFE in projection ────────────────

    let planId: string

    await test.step("Navigate to Timeline tab", async () => {
      planId = page.url().split("/").pop()!
      expect(planId).toBeTruthy()

      // Wait for the plan view to fully load
      await expect(page.getByRole("button", { name: /my path/i })).toBeVisible({
        timeout: 15_000,
      })

      // Click the "My Path" tab (Timeline)
      await page.getByRole("button", { name: /my path/i }).click()

      // Wait for the timeline content to render
      await expect(page.getByText("Wealth Journey")).toBeVisible({
        timeout: 15_000,
      })
    })

    await test.step("Expand Income Breakdown and verify Private Pension column", async () => {
      // The Income Breakdown is in a CollapsibleSection — click to expand
      const incomeBreakdownHeader = page.getByText("Income Breakdown")
      await expect(incomeBreakdownHeader).toBeVisible({ timeout: 10_000 })
      await incomeBreakdownHeader.click()

      // Wait for the table to render and check for "Private Pension" column header
      // This column only appears when the backend computes non-zero assetPensions
      await expect(page.getByText("Private Pension").first()).toBeVisible({
        timeout: 15_000,
      })
    })

    await test.step("Verify Private Pension values appear at payout age", async () => {
      // Expand all years to see the full table
      const expandBtn = page.getByRole("button", {
        name: /expand all/i,
      })
      await expect(expandBtn).toBeVisible({ timeout: 5_000 })
      await expandBtn.click()

      // Wait for all rows to appear
      await page.waitForTimeout(1_000)

      // The Private Pension column cells should contain dollar values
      // starting at payout age (65). Find rows with age >= 65
      // and verify at least one has a non-dash Private Pension value.
      const privatePensionValues = await page.evaluate(() => {
        const table = document.querySelector("table.min-w-full")
        if (!table) return []

        // Find the Private Pension column index
        const headers = Array.from(table.querySelectorAll("thead th"))
        const ppIndex = headers.findIndex((th) =>
          th.textContent?.includes("Private Pension"),
        )
        if (ppIndex === -1) return []

        // Get values from each data row at the Private Pension column
        const rows = Array.from(table.querySelectorAll("tbody tr"))
        const values: { age: string; value: string }[] = []
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll("td"))
          if (cells.length <= ppIndex) continue
          const ageCell = cells[0]?.textContent?.trim() || ""
          const ppCell = cells[ppIndex]?.textContent?.trim() || ""
          if (ppCell && ppCell !== "-" && ppCell !== "...") {
            values.push({ age: ageCell, value: ppCell })
          }
        }
        return values
      })

      // There should be at least one row with a Private Pension value
      expect(privatePensionValues.length).toBeGreaterThan(0)

      // Verify values are dollar amounts (start with $)
      for (const entry of privatePensionValues) {
        expect(entry.value).toMatch(/^\$[\d,]+$/)
      }

      // Verify payouts start at or after age 65 (CPF LIFE payout start age)
      const firstPayoutAge = parseInt(privatePensionValues[0].age)
      expect(firstPayoutAge).toBeGreaterThanOrEqual(65)
    })

    await test.step("Verify CPF LIFE projection via API", async () => {
      // Call the CPF LIFE projection endpoint directly to validate calculation
      const apiResult = await page.evaluate(async () => {
        const res = await fetch("/api/projection/cpf-life", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentAge: 46,
            lifeExpectancy: 85,
            subAccountBalances: {
              OA: 50000,
              SA: 80000,
              MA: 20000,
              RA: 0,
            },
            cpfLifePlan: "STANDARD",
            payoutStartAge: 65,
            pledgeForErs: false,
          }),
        })
        if (!res.ok) {
          return { ok: false, status: res.status, body: await res.text() }
        }
        const json = await res.json()
        return { ok: true, data: json }
      })

      expect(apiResult.ok).toBe(true)

      const response = apiResult.data?.data || apiResult.data
      // Verify the response has expected fields
      expect(response.monthlyPayout).toBeDefined()
      expect(response.payoutStartAge).toBe(65)
      expect(response.cpfLifePlan).toBe("STANDARD")

      // Monthly payout should be positive and reasonable
      const monthlyPayout = parseFloat(response.monthlyPayout)
      expect(monthlyPayout).toBeGreaterThan(0)

      // RA at payout should be positive
      const raAtPayout = parseFloat(response.raBalanceAtPayout)
      expect(raAtPayout).toBeGreaterThan(0)

      // Annuity details should be present
      expect(response.annuityDetails).toBeDefined()
      expect(parseFloat(response.annuityDetails.presentValue)).toBeGreaterThan(
        0,
      )
    })
  })
})
