import { expect, test } from "@playwright/test"

test.describe("FX Calculator", () => {
  test("should select currencies by typing and remember them", async ({
    page,
  }) => {
    await page.goto("/fx/calculator")

    await page.getByRole("combobox", { name: "From" }).fill("sgd")
    await page.getByRole("combobox", { name: "From" }).press("Enter")
    await page.getByRole("combobox", { name: "To" }).fill("ringgit")
    await page.getByRole("combobox", { name: "To" }).press("Enter")

    await expect(page.getByText(/^1 SGD = [\d.]+ MYR$/)).toBeVisible()

    await page.reload()

    await expect(page.getByText(/^1 SGD = [\d.]+ MYR$/)).toBeVisible()

    await page.getByRole("button", { name: "Swap currencies" }).click()
    await page.reload()

    await expect(page.getByText(/^1 MYR = [\d.]+ SGD$/)).toBeVisible()
  })

  test("should stay open when Escape dismisses the currency list", async ({
    page,
  }) => {
    await page.goto("/fx/calculator")
    await expect(page.getByRole("combobox", { name: "From" })).toBeEnabled()

    await page.getByRole("combobox", { name: "From" }).fill("dollar")
    await expect(page.getByRole("option")).not.toHaveCount(0)
    await page.keyboard.press("Escape")

    await expect(page.getByRole("option")).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "FX Calculator" }),
    ).toBeVisible()
  })
})
