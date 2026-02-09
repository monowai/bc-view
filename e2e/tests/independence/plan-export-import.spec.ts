import { test, expect } from "@playwright/test"
import fs from "fs"

/**
 * E2E test: Create an independence plan via the wizard, export it as JSON,
 * delete it, re-import the JSON, and verify the data survived the round-trip.
 *
 * The Import button is hidden on mobile (`hidden sm:flex`), so this test
 * targets the chromium (desktop) project only.
 */
test.describe("Plan Export / Import Round-Trip", () => {
  test("should export a plan, delete it, import it, and verify data", async ({
    page,
  }) => {
    test.setTimeout(120_000)

    const planName = "E2E Export Test"
    const currency = "NZD"
    const yearOfBirth = "1985"
    const retirementAge = "65"
    const lifeExpectancy = "90"
    const expectedHorizon = Number(lifeExpectancy) - Number(yearOfBirth)

    let downloadedFilePath: string
    let exportedJson: Record<string, unknown>

    // ─── Phase 1: Clean up existing plans ────────────────────────

    await test.step("Clean up existing independence plans", async () => {
      await page.goto("/")
      await page.waitForLoadState("networkidle")

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
    })

    // ─── Phase 2: Create a plan via the wizard ───────────────────

    await test.step("Navigate to the independence wizard", async () => {
      await page.goto("/independence")
      await page.waitForLoadState("networkidle")

      const createLink = page.getByRole("link", { name: /create.*plan/i })
      await expect(createLink.first()).toBeVisible({ timeout: 10_000 })
      await createLink.first().click()
      await page.waitForURL(/\/independence\/wizard/, { timeout: 10_000 })
      await page.waitForLoadState("networkidle")
    })

    await test.step("Step 1 - Personal Info", async () => {
      await page.locator("#planName").fill(planName)
      await page.locator("#expensesCurrency").selectOption(currency)
      await page.locator("#yearOfBirth").fill(yearOfBirth)
      await page.locator("#targetRetirementAge").fill(retirementAge)
      await page.locator("#lifeExpectancy").fill(lifeExpectancy)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Steps 2-7 - Advance through defaults", async () => {
      for (let step = 2; step <= 7; step++) {
        await page.waitForTimeout(500)
        await page
          .getByRole("button", { name: "Next", exact: true })
          .click()
      }
    })

    await test.step("Step 8 - Save Plan", async () => {
      const saveBtn = page.getByRole("button", { name: /save plan/i })
      await expect(saveBtn).toBeVisible({ timeout: 5_000 })
      await saveBtn.click()
      await page.waitForURL(/\/independence\/plans\//, { timeout: 30_000 })
    })

    // ─── Phase 3: Export the plan ────────────────────────────────

    await test.step("Export the plan as JSON", async () => {
      // Wait for plan header to render
      await expect(page.getByText(planName)).toBeVisible({ timeout: 10_000 })

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click('button[title="Export plan as JSON"]'),
      ])

      downloadedFilePath = (await download.path())!
      expect(downloadedFilePath).toBeTruthy()

      // Verify filename
      const suggestedName = download.suggestedFilename()
      expect(suggestedName).toContain("_retirement_plan.json")

      // Parse and validate exported JSON
      const content = fs.readFileSync(downloadedFilePath, "utf-8")
      exportedJson = JSON.parse(content)
      expect(exportedJson.name).toBe(planName)
      expect(exportedJson.planningHorizonYears).toBe(expectedHorizon)
      expect(exportedJson.expensesCurrency).toBe(currency)
      expect(exportedJson.yearOfBirth).toBe(Number(yearOfBirth))
    })

    // ─── Phase 4: Delete the plan ────────────────────────────────

    await test.step("Delete the plan via API", async () => {
      // Get the plan ID from the current URL
      const planId = page.url().split("/").pop()
      expect(planId).toBeTruthy()

      await page.evaluate(
        (id) =>
          fetch(`/api/independence/plans/${id}`, { method: "DELETE" }),
        planId,
      )

      // Navigate to plans list and verify it's gone
      await page.goto("/independence")
      await page.waitForLoadState("networkidle")
      await expect(page.getByText(planName)).not.toBeVisible({
        timeout: 10_000,
      })
    })

    // ─── Phase 5: Import the plan ────────────────────────────────

    await test.step("Import the exported JSON file", async () => {
      const fileChooserPromise = page.waitForEvent("filechooser")
      await page.getByRole("button", { name: /import/i }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(downloadedFilePath)

      // Should redirect to the newly-imported plan's view page
      await page.waitForURL(/\/independence\/plans\//, { timeout: 30_000 })
    })

    // ─── Phase 6: Verify the imported plan ───────────────────────

    await test.step("Verify imported plan data in the UI", async () => {
      await expect(page.getByText(planName)).toBeVisible({ timeout: 10_000 })
      await expect(
        page.getByText(`${expectedHorizon} year horizon`),
      ).toBeVisible({ timeout: 5_000 })
    })

    await test.step("Verify imported plan data via API", async () => {
      const newPlanId = page.url().split("/").pop()
      expect(newPlanId).toBeTruthy()

      const planData = await page.evaluate(async (id) => {
        const res = await fetch(`/api/independence/plans/${id}`)
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        const json = await res.json()
        return json.data
      }, newPlanId)

      expect(planData.name).toBe(planName)
      expect(planData.planningHorizonYears).toBe(expectedHorizon)
      expect(planData.expensesCurrency).toBe(currency)
      expect(planData.yearOfBirth).toBe(Number(yearOfBirth))
      expect(planData.targetRetirementAge).toBe(Number(retirementAge))
      expect(planData.lifeExpectancy).toBe(Number(lifeExpectancy))
    })
  })
})
