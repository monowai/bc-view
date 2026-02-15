import { test, expect } from "@playwright/test"
import {
  SG_POSITIONS,
  US_POSITIONS,
  DemoPosition,
} from "../../fixtures/demo-transactions"

/**
 * Demo User Setup — creates a realistic 45-year-old Singaporean investor
 * with SG + US brokerage portfolios and a CPF-backed independence plan.
 *
 * Designed for video recording: UI-driven where visual, API-driven where
 * the UI path requires infrastructure (message broker).
 *
 * Run:  npx playwright test e2e/tests/demo/demo-setup.spec.ts --project=chromium
 * Video output lands in test-results/
 */
test.use({ video: "on" })

test.describe("Demo User Setup", () => {
  test("set up demo user with portfolios and independence plan", async ({
    page,
  }) => {
    test.setTimeout(180_000)

    // ─── Phase 0: Clean Slate ─────────────────────────────────────

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

    // ─── Phase 1: Onboarding Wizard (UI — visual for video) ──────

    await test.step("Navigate to onboarding", async () => {
      await page.goto("/onboarding")
      await page.waitForLoadState("domcontentloaded")
      await expect(page.getByText("Welcome to Beancounter")).toBeVisible({
        timeout: 15_000,
      })
    })

    await test.step("Step 1 - Welcome: enter name", async () => {
      await page.locator("#preferredName").fill("Wei Lin")
      await page.getByRole("button", { name: "Continue" }).click()
    })

    await test.step("Step 2 - Currency: select SGD", async () => {
      const sgdButton = page.locator("button").filter({ hasText: "SGD" })
      await expect(sgdButton.first()).toBeVisible({ timeout: 10_000 })
      await sgdButton.first().click()
      await page.getByRole("button", { name: "Continue" }).click()
      // Step 3 (Portfolio) is auto-skipped, lands on step 4
    })

    await test.step("Step 4 - Assets: add bank accounts", async () => {
      // Wait for the assets step — card selection is visible
      const bankCard = page.getByRole("button", { name: /bank account/i })
      await expect(bankCard.first()).toBeVisible({ timeout: 10_000 })

      // ── Add POSB Savings (SGD) ──
      await bankCard.first().click()
      // Form appears with Account Name, Currency (pre-set to SGD), Balance
      const nameInput = page.getByPlaceholder(/main savings/i)
      await expect(nameInput).toBeVisible({ timeout: 5_000 })
      await nameInput.fill("POSB Savings")
      // Currency defaults to SGD — no change needed
      const balanceInput = page.getByPlaceholder("Optional")
      await balanceInput.fill("25000")
      await page.getByRole("button", { name: /save account/i }).click()

      // ── Add DBS Multicurrency (USD) ──
      // After save, form resets to card selection
      await expect(bankCard.first()).toBeVisible({ timeout: 5_000 })
      await bankCard.first().click()
      await expect(nameInput).toBeVisible({ timeout: 5_000 })
      await nameInput.fill("DBS Multicurrency")
      // Change currency to USD
      const currencySelect = page
        .locator("select")
        .filter({ hasText: /SGD|USD/ })
      await currencySelect.first().selectOption("USD")
      await balanceInput.fill("8000")
      await page.getByRole("button", { name: /save account/i }).click()

      // Skip pension/insurance — click "Skip for now"
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

    await test.step("Step 6 - Independence: complete setup", async () => {
      const completeBtn = page.getByRole("button", {
        name: /complete setup/i,
      })
      await expect(completeBtn).toBeVisible({ timeout: 5_000 })
      await completeBtn.click()
      await expect(page.getByRole("button", { name: /done/i })).toBeVisible({
        timeout: 30_000,
      })
    })

    await test.step("Step 7 - Complete: click Done", async () => {
      await page.getByRole("button", { name: /done/i }).click()
      await page.waitForURL("/", { timeout: 10_000 })
      await page.waitForLoadState("domcontentloaded")
    })

    // ─── Phase 2: Create SG Brokerage Portfolio (UI form) ────────

    await test.step("Create SG brokerage portfolio (IBSG)", async () => {
      await page.goto("/portfolios/__NEW__")
      await page.waitForLoadState("domcontentloaded")

      await page.fill('input[name="code"]', "IBSG")
      await page.fill('input[name="name"]', "Interactive Brokers SG")

      // Select currency SGD via ReactSelect
      const currencySelect = page.locator('[id*="currency"]').first()
      if (await currencySelect.isVisible({ timeout: 5_000 })) {
        await currencySelect.click()
        await page
          .locator('[id*="option"]')
          .filter({ hasText: "SGD" })
          .first()
          .click()
      }

      // Select base SGD via ReactSelect
      const baseSelect = page.locator('[id*="base"]').first()
      if (await baseSelect.isVisible({ timeout: 3_000 })) {
        await baseSelect.click()
        await page
          .locator('[id*="option"]')
          .filter({ hasText: "SGD" })
          .first()
          .click()
      }

      await Promise.all([
        page.waitForURL(/\/portfolios\/(?!__NEW__)/, { timeout: 15_000 }),
        page.click('button[type="submit"]'),
      ])

      await expect(page.locator('input[name="code"]')).toHaveValue("IBSG")
    })

    // ─── Phase 3: Create US Brokerage Portfolio (UI form) ────────

    await test.step("Create US brokerage portfolio (IBUS)", async () => {
      await page.goto("/portfolios/__NEW__")
      await page.waitForLoadState("domcontentloaded")

      await page.fill('input[name="code"]', "IBUS")
      await page.fill('input[name="name"]', "Interactive Brokers US")

      // Select currency USD via ReactSelect
      const currencySelect = page.locator('[id*="currency"]').first()
      if (await currencySelect.isVisible({ timeout: 5_000 })) {
        await currencySelect.click()
        await page
          .locator('[id*="option"]')
          .filter({ hasText: "USD" })
          .first()
          .click()
      }

      // Select base USD via ReactSelect
      const baseSelect = page.locator('[id*="base"]').first()
      if (await baseSelect.isVisible({ timeout: 3_000 })) {
        await baseSelect.click()
        await page
          .locator('[id*="option"]')
          .filter({ hasText: "USD" })
          .first()
          .click()
      }

      await Promise.all([
        page.waitForURL(/\/portfolios\/(?!__NEW__)/, { timeout: 15_000 }),
        page.click('button[type="submit"]'),
      ])

      await expect(page.locator('input[name="code"]')).toHaveValue("IBUS")
    })

    // ─── Phase 4: Import Positions via API ───────────────────────

    await test.step("Resolve portfolio IDs", async () => {
      // Fetch portfolio list to get IDs for IBSG and IBUS
      const portfolioMap = await page.evaluate(async () => {
        const res = await fetch("/api/portfolios")
        if (!res.ok) throw new Error("Failed to fetch portfolios")
        const json = await res.json()
        const map: Record<string, string> = {}
        for (const p of json.data || []) {
          map[p.code] = p.id
        }
        return map
      })

      expect(portfolioMap["IBSG"]).toBeTruthy()
      expect(portfolioMap["IBUS"]).toBeTruthy()

      // Store for subsequent steps
      ;(test.info() as unknown as { portfolioMap: Record<string, string> }).portfolioMap =
        portfolioMap
    })

    await test.step("Import SG positions via API", async () => {
      await importPositions(page, "IBSG", SG_POSITIONS)
    })

    await test.step("Import US positions via API", async () => {
      await importPositions(page, "IBUS", US_POSITIONS)
    })

    await test.step("Trigger valuations", async () => {
      // Request holdings to trigger position valuation
      await page.evaluate(async () => {
        await fetch("/api/holdings/IBSG?asAt=today")
      })
      await page.evaluate(async () => {
        await fetch("/api/holdings/IBUS?asAt=today")
      })
    })

    // ─── Phase 5: Independence Plan (UI wizard — visual) ─────────

    await test.step("Navigate to Independence wizard", async () => {
      await page.goto("/independence")
      await page.waitForLoadState("domcontentloaded")
      const createLink = page.getByRole("link", { name: /create.*plan/i })
      await expect(createLink.first()).toBeVisible({ timeout: 10_000 })
      await createLink.first().click()
      await page.waitForURL(/\/independence\/wizard/, { timeout: 10_000 })
      await page.waitForLoadState("domcontentloaded")
    })

    await test.step("Independence Step 1 - Personal Info", async () => {
      await page.locator("#planName").fill("Financial Independence")
      await page.locator("#expensesCurrency").selectOption("SGD")
      await page.locator("#yearOfBirth").fill("1981")
      await page.locator("#targetRetirementAge").fill("55")
      await page.locator("#lifeExpectancy").fill("85")
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 2 - Working Expenses: skip", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 3 - Contributions: skip", async () => {
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Independence Step 4 - Assets: create CPF account", async () => {
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
        .fill("Central Provident Fund")

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

      // Fill sub-account balances: OA=80000, SA=50000, MA=30000, RA=15000
      const balanceInputs = page.locator(
        'table input[type="number"][step="100"]',
      )
      await expect(balanceInputs.first()).toBeVisible({ timeout: 5_000 })

      const balances = [80000, 50000, 30000, 15000]
      const count = await balanceInputs.count()
      for (let i = 0; i < Math.min(count, balances.length); i++) {
        await balanceInputs.nth(i).fill(String(balances[i]))
      }

      // Select SGD portfolio for balance transaction
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

      // Create the retirement account
      const createBtn = page.getByRole("button", {
        name: /create retirement account/i,
      })
      await expect(createBtn).toBeVisible()
      await createBtn.click()
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
      await page.waitForURL(/\/independence\/plans\//, { timeout: 30_000 })
    })

    // ─── Phase 6: Verify Demo (visual tour for video) ────────────

    await test.step("Verify wealth overview", async () => {
      await page.goto("/wealth")
      await page.waitForLoadState("domcontentloaded")

      // Net worth should be non-zero
      const netWorthSection = page.locator("body")
      await expect(netWorthSection).not.toContainText("$0.00", {
        timeout: 15_000,
      })

      // Should mention multiple portfolios
      await expect(page.getByText(/across.*portfolios/i).first()).toBeVisible({
        timeout: 10_000,
      })
    })

    await test.step("Verify SG holdings", async () => {
      const newPage = await page.context().newPage()
      await newPage.goto("/holdings/IBSG")
      await newPage.waitForLoadState("domcontentloaded")

      // Verify at least one SG position is visible
      await expect(newPage.getByText("SGD").first()).toBeVisible({
        timeout: 15_000,
      })

      await newPage.close()
    })

    await test.step("Verify US holdings", async () => {
      const newPage = await page.context().newPage()
      await newPage.goto("/holdings/IBUS")
      await newPage.waitForLoadState("domcontentloaded")

      // Verify at least one US position is visible
      await expect(newPage.getByText("USD").first()).toBeVisible({
        timeout: 15_000,
      })

      await newPage.close()
    })

    await test.step("Verify independence plan exists", async () => {
      await page.goto("/independence")
      await page.waitForLoadState("domcontentloaded")

      await expect(
        page.getByText("Financial Independence").first(),
      ).toBeVisible({ timeout: 10_000 })
    })
  })
})

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Resolve asset IDs and create BUY transactions for a portfolio via API.
 */
async function importPositions(
  page: import("@playwright/test").Page,
  portfolioCode: string,
  positions: DemoPosition[],
): Promise<void> {
  // Get portfolio ID by code
  const portfolioId = await page.evaluate(async (code) => {
    const res = await fetch("/api/portfolios")
    if (!res.ok) throw new Error("Failed to fetch portfolios")
    const json = await res.json()
    const portfolio = (json.data || []).find(
      (p: { code: string }) => p.code === code,
    )
    if (!portfolio) throw new Error(`Portfolio ${code} not found`)
    return portfolio.id as string
  }, portfolioCode)

  for (const pos of positions) {
    // Resolve market asset to get its ID
    const assetId = await page.evaluate(
      async ({ market, code }) => {
        const res = await fetch(
          `/api/assets/resolve?market=${market}&code=${code}`,
        )
        if (!res.ok) {
          const text = await res.text()
          throw new Error(
            `Failed to resolve asset ${market}:${code} — ${res.status} ${text}`,
          )
        }
        const json = await res.json()
        // Response is { data: { id, code, name, ... } }
        if (!json.data?.id)
          throw new Error(`No asset found for ${market}:${code}`)
        return json.data.id as string
      },
      { market: pos.market, code: pos.code },
    )

    // Create BUY transaction
    await page.evaluate(
      async ({ portfolioId, assetId, pos }) => {
        const res = await fetch("/api/trns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            data: [
              {
                assetId,
                trnType: "BUY",
                quantity: pos.quantity,
                price: pos.price,
                tradeCurrency: pos.currency,
                tradeDate: pos.tradeDate,
                status: "SETTLED",
              },
            ],
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(
            `Failed to create transaction for ${pos.code}: ${res.status} ${text}`,
          )
        }
      },
      {
        portfolioId,
        assetId,
        pos: {
          quantity: pos.quantity,
          price: pos.price,
          currency: pos.currency,
          tradeDate: pos.tradeDate,
          code: pos.code,
        },
      },
    )
  }
}
