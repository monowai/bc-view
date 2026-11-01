import { test, expect } from "@playwright/test"
import fs from "fs"
import { deleteIndependencePlans } from "../../fixtures/test-data"

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
    // Import button is hidden on mobile (hidden sm:flex)
    const viewport = page.viewportSize()
    test.skip(
      viewport !== null && viewport.width < 640,
      "Import button hidden on mobile",
    )

    test.setTimeout(120_000)

    const planName = "E2E Export Test"
    const currency = "NZD"
    const yearOfBirth = "1985"
    const retirementAge = "65"
    const lifeExpectancy = "90"
    const expectedHorizon = Number(lifeExpectancy) - Number(retirementAge)

    let downloadedFilePath: string
    let exportedJson: Record<string, unknown>

    // ─── Phase 1: Clean up existing plans ────────────────────────

    await test.step("Clean up existing independence plans", async () => {
      await page.goto("/")
      await page.waitForLoadState("domcontentloaded")

      await deleteIndependencePlans(page)

      // Seed Independence settings (moved out of the plan wizard).
      // The wizard derives planningHorizonYears from these settings.
      await page.evaluate(
        async ({ yearOfBirth, targetAge, lifeExp }) => {
          await fetch("/api/independence/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              yearOfBirth,
              targetIndependenceAge: targetAge,
              lifeExpectancy: lifeExp,
            }),
          })
        },
        {
          yearOfBirth: Number(yearOfBirth),
          targetAge: Number(retirementAge),
          lifeExp: Number(lifeExpectancy),
        },
      )
    })

    // ─── Phase 2: Create a plan via the wizard ───────────────────

    await test.step("Navigate to the independence wizard", async () => {
      await page.goto("/independence")
      await page.waitForLoadState("domcontentloaded")

      // The wizard link carries ?plan=<journey> once a journey exists, so
      // match the path alone.
      const createLink = page.locator('a[href^="/independence/wizard"]')
      await expect(createLink.first()).toBeVisible({ timeout: 10_000 })
      await createLink.first().click()
      await page.waitForURL(/\/independence\/wizard/, { timeout: 10_000 })
      await page.waitForLoadState("domcontentloaded")
    })

    await test.step("Step 1 - Personal Info", async () => {
      await page.locator("#planName").fill(planName)
      await page.locator("#expensesCurrency").selectOption(currency)
      await page.getByRole("button", { name: "Next", exact: true }).click()
    })

    await test.step("Steps 2-4 - Advance through defaults", async () => {
      for (let step = 2; step <= 4; step++) {
        await page.waitForTimeout(500)
        await page.getByRole("button", { name: "Next", exact: true }).click()
      }
    })

    await test.step("Step 5 - Save Plan", async () => {
      const saveBtn = page.getByRole("button", { name: /save plan/i })
      await expect(saveBtn).toBeVisible({ timeout: 5_000 })
      await saveBtn.click()
      await page.waitForURL(/\/independence\/plans\//, { timeout: 30_000 })
    })

    // ─── Phase 3: Export the plan ────────────────────────────────

    await test.step("Export the plan as JSON", async () => {
      // Wait for plan header to render. Phasing renames the first stage, so
      // the plan keeps no name of ours to look for.
      await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 })

      // Wait for the export button to be ready
      await expect(
        page.locator('button[title="Export plan as JSON"]'),
      ).toBeVisible({ timeout: 10_000 })

      // Disable File System Access API so the fallback download path is used
      // (showSaveFilePicker opens a native OS dialog that Playwright can't handle)
      await page.evaluate(() => {
        delete (window as unknown as Record<string, unknown>).showSaveFilePicker
      })

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
      // yearOfBirth / lifeExpectancy now live on user Independence settings,
      // not the plan itself — plan carries planningHorizonYears instead.
      const content = fs.readFileSync(downloadedFilePath, "utf-8")
      exportedJson = JSON.parse(content)
      expect(exportedJson.name).toBeTruthy()
      expect(exportedJson.planningHorizonYears).toBe(expectedHorizon)
      expect(exportedJson.expensesCurrency).toBe(currency)
    })

    // ─── Phase 4: Delete the plan ────────────────────────────────

    await test.step("Delete the plan via API", async () => {
      // Get the plan ID from the current URL
      const planId = page.url().split("/").pop()
      expect(planId).toBeTruthy()

      await page.evaluate(
        (id) => fetch(`/api/independence/plans/${id}`, { method: "DELETE" }),
        planId,
      )

      const deleted = await page.evaluate(async (id) => {
        const res = await fetch(`/api/independence/plans/${id}`)
        return res.status
      }, planId)
      expect(deleted).toBe(404)

      await page.goto("/independence")
      await page.waitForLoadState("domcontentloaded")
    })

    // ─── Phase 5: Import the plan ────────────────────────────────

    await test.step("Import the exported JSON file", async () => {
      const fileChooserPromise = page.waitForEvent("filechooser")
      await page.getByRole("button", { name: "Plan options" }).click()
      await page.getByRole("menuitem", { name: /import/i }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(downloadedFilePath)

      // Should redirect to the newly-imported plan's view page
      await page.waitForURL(/\/independence\/plans\//, { timeout: 30_000 })
    })

    // ─── Phase 6: Verify the imported plan ───────────────────────

    await test.step("Verify imported plan data in the UI", async () => {
      await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 })
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

      // yearOfBirth / lifeExpectancy now live on user Independence settings,
      // not the plan itself.
      expect(planData.name).toBe(exportedJson.name)
      expect(planData.planningHorizonYears).toBe(expectedHorizon)
      expect(planData.expensesCurrency).toBe(currency)
    })
  })
})
