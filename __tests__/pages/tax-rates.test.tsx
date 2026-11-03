import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import TaxRatesPageDefault from "@pages/tax-rates"
import SettingsPageDefault from "@pages/settings"
import {
  deleteTaxRate,
  getMe,
  getTaxRates,
  saveTaxRate,
} from "@utils/api/client/account"

jest.mock("@utils/api/client/account", () => ({
  deleteTaxRate: jest.fn(),
  getMe: jest.fn(),
  getTaxRates: jest.fn(),
  saveTaxRate: jest.fn(),
  updateMe: jest.fn(),
}))

jest.mock("@utils/api/client/independence", () => ({
  updateIndependenceSettings: jest.fn(),
}))

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ admin: false, isLoading: false }),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ refetch: jest.fn() }),
}))

jest.mock("@components/features/settings/ApiKeysTab", () => ({
  __esModule: true,
  default: () => null,
}))

const reply = (status: number, data?: unknown): Response =>
  ({
    ok: status < 300,
    status,
    json: () => Promise.resolve({ data, message: data }),
  }) as unknown as Response

const TaxRatesPage = TaxRatesPageDefault as React.ComponentType
const SettingsPage = SettingsPageDefault as React.ComponentType

async function openTaxRates(): Promise<void> {
  render(<TaxRatesPage />)
  await screen.findByText("Income Tax Rates")
}

async function openSettingsTax(): Promise<void> {
  render(<SettingsPage />)
  fireEvent.click(await screen.findByRole("button", { name: "Tax" }))
}

const pages: [string, () => Promise<void>][] = [
  ["tax-rates page", openTaxRates],
  ["settings tax tab", openSettingsTax],
]

const optionsFor = (code: string): HTMLOptionElement[] =>
  (screen.getAllByRole("option") as HTMLOptionElement[]).filter(
    (o) => o.value === code,
  )

function addRate(country: string, rate: string): void {
  fireEvent.change(screen.getAllByRole("combobox").at(-1) as HTMLElement, {
    target: { value: country },
  })
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: rate } })
  fireEvent.click(screen.getByRole("button", { name: /Add/ }))
}

describe.each(pages)("%s tax rate editing", (_name, open) => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getMe as jest.Mock).mockResolvedValue(reply(200, {}))
    ;(getTaxRates as jest.Mock).mockResolvedValue(
      reply(200, [{ countryCode: "AU", rate: 0.3 }]),
    )
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }) as unknown as typeof fetch
  })

  it("should offer only countries without a rate", async () => {
    await open()
    expect(optionsFor("AU")).toHaveLength(1)
    expect(optionsFor("AU")[0].textContent).toMatch(/AU - Australia/)
    expect(optionsFor("NZ")[0].textContent).toBe("NZ - New Zealand")
  })

  it("should convert a percent to a rate and add it", async () => {
    ;(saveTaxRate as jest.Mock).mockResolvedValue(
      reply(200, { countryCode: "NZ", rate: 0.2 }),
    )
    await open()
    addRate("NZ", "20")

    await screen.findByText("Tax rate saved")
    expect(saveTaxRate).toHaveBeenCalledWith({ countryCode: "NZ", rate: 0.2 })
    expect(screen.getAllByTitle("Delete")).toHaveLength(2)
  })

  it("should reject a rate over 100% without saving", async () => {
    await open()
    addRate("NZ", "101")

    expect(
      await screen.findByText("Rate must be between 0 and 100%"),
    ).toBeInTheDocument()
    expect(saveTaxRate).not.toHaveBeenCalled()
  })

  it("should report the server message when a save is refused", async () => {
    ;(saveTaxRate as jest.Mock).mockResolvedValue(reply(400, "Bad rate"))
    await open()
    addRate("NZ", "20")

    expect(await screen.findByText("Bad rate")).toBeInTheDocument()
  })

  it("should remove a rate on a 204 delete", async () => {
    ;(deleteTaxRate as jest.Mock).mockResolvedValue(reply(204))
    await open()
    fireEvent.click(screen.getByTitle("Delete"))

    await screen.findByText("Tax rate deleted")
    await waitFor(() => expect(deleteTaxRate).toHaveBeenCalledWith("AU"))
    expect(screen.queryByTitle("Delete")).toBeNull()
  })

  it("should report a failed delete and keep the rate", async () => {
    ;(deleteTaxRate as jest.Mock).mockResolvedValue(reply(500))
    await open()
    fireEvent.click(screen.getByTitle("Delete"))

    expect(
      await screen.findByText("Failed to delete tax rate"),
    ).toBeInTheDocument()
    expect(screen.getByTitle("Delete")).toBeInTheDocument()
  })
})
