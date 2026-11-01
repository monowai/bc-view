import { test, expect } from "@playwright/test"
import {
  createCpfAccount,
  deleteIndependencePlans,
} from "../../fixtures/test-data"

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

      await deleteIndependencePlans(page)

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

      // Step 5 - Independence: skip (settings seeded via API in Phase 1;
      // the CPF plan is created through the independence wizard in Phase 3)
      await page.getByRole("button", { name: /skip for now/i }).click()
      await page.getByRole("button", { name: "Continue" }).click()

      // Step 6 - Brokerage: complete setup
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

    await test.step("Create CPF account", async () => {
      await createCpfAccount(page, {
        name: "CPF LIFE Test Account",
        portfolio: "SGD",
        balances: { OA: 50000, SA: 80000, MA: 20000, RA: 0 },
      })
    })

    await test.step("Navigate to Independence wizard", async () => {
      await page.goto("/independence")
      await page.waitForLoadState("domcontentloaded")
      // Header link is labelled "Create Phase"; the empty state has its own
      // wizard CTA — match by target so either works.
      const createLink = page.locator('a[href="/independence/wizard"]')
      await expect(createLink.first()).toBeVisible({ timeout: 10_000 })
      await createLink.first().click()
      await page.waitForURL(/\/independence\/wizard/, { timeout: 10_000 })
      await page.waitForLoadState("domcontentloaded")
    })

    await test.step("Step 1 - Personal Info", async () => {
      await page.locator("#planName").fill("CPF LIFE Test Plan")
      await page.locator("#expensesCurrency").selectOption("SGD")
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Steps 2-3: Assumptions and Income", async () => {
      // Step 2 - Assumptions
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()

      // Step 3 - Income
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Step 4 - Retirement Expenses", async () => {
      // Expenses opens on the Mood Board; category inputs sit under Detailed
      await page.getByRole("button", { name: "Detailed", exact: true }).click()
      const expenseInputs = page.locator('input[min="0"][step="50"]')
      await expect(expenseInputs.first()).toBeVisible({ timeout: 10_000 })
      await expenseInputs.nth(0).fill("1500")
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Step 5 - Save plan", async () => {
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

      // Wait for the plan view to fully load; the tab enables once assets do
      const yourPath = page.getByRole("button", { name: /your path/i })
      await expect(yourPath).toBeEnabled({ timeout: 15_000 })
      await yourPath.click()

      // Wait for the timeline content to render
      await expect(page.getByText("Wealth Journey")).toBeVisible({
        timeout: 15_000,
      })
    })

    await test.step("Verify Private Pension column in Income Breakdown", async () => {
      // The Income Breakdown CollapsibleSection is open by default — clicking
      // its header would TOGGLE it closed. Just scroll it into view and check.
      const incomeBreakdownButton = page.getByRole("button", {
        name: /income breakdown/i,
      })
      await expect(incomeBreakdownButton).toBeVisible({ timeout: 10_000 })
      await incomeBreakdownButton.scrollIntoViewIfNeeded()

      // The Private Pension column only appears when assetPensions > 0 in the
      // projection, which requires CPF LIFE to produce payouts.
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

      // Verify values are dollar amounts ($ or S$)
      for (const entry of privatePensionValues) {
        expect(entry.value).toMatch(/^S?\$[\d,]+$/)
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
