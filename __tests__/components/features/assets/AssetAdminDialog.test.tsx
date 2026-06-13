import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSWR from "swr"
import { beforeEach, describe, it } from "@jest/globals"
import AssetAdminDialog from "@components/features/assets/AssetAdminDialog"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  useSWRConfig: () => ({ mutate: jest.fn() }),
}))

const asset = {
  id: "a1",
  code: "AAPL",
  name: "Apple Inc",
  assetCategory: { id: "EQUITY", name: "Equity" },
  market: { code: "NASDAQ", currency: { code: "USD" } },
}

const categories = {
  data: [
    { id: "EQUITY", name: "Equity" },
    { id: "ETF", name: "ETF" },
  ],
}

function mockSwrByKey(): void {
  ;(useSWR as jest.Mock).mockImplementation((...args: unknown[]) => {
    const key = args[0]
    if (typeof key === "string" && key.includes("/api/categories")) {
      return {
        data: categories,
        error: null,
        isLoading: false,
        mutate: jest.fn(),
      }
    }
    if (typeof key === "string" && key.startsWith("/api/assets/")) {
      return {
        data: { data: asset },
        error: null,
        isLoading: false,
        mutate: jest.fn(),
      }
    }
    return { data: undefined, error: null, isLoading: false, mutate: jest.fn() }
  })
}

describe("AssetAdminDialog", () => {
  beforeEach(() => {
    mockSwrByKey()
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: asset }),
        text: () => Promise.resolve(""),
      }),
    ) as unknown as typeof fetch
  })

  it("renders as a titled popup with Details and Classify tabs", () => {
    render(<AssetAdminDialog assetId="a1" onClose={jest.fn()} />)
    expect(screen.getByText(/Asset Admin · AAPL/)).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /classify/i })).toBeInTheDocument()
  })

  it("shows an editable Name and a read-only Market on the Details tab", () => {
    render(<AssetAdminDialog assetId="a1" onClose={jest.fn()} />)
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement
    expect(nameInput.value).toBe("Apple Inc")
    expect(nameInput.readOnly).toBe(false)
    expect(screen.getByText("NASDAQ")).toBeInTheDocument()
    expect(screen.queryByLabelText(/^market$/i)).not.toBeInTheDocument()
  })

  it("PATCHes /api/assets/admin/{id} with the edited name and category on Save", async () => {
    render(<AssetAdminDialog assetId="a1" onClose={jest.fn()} />)
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Apple Computer" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/assets/admin/a1",
        expect.objectContaining({ method: "PATCH" }),
      )
    })
    const body = JSON.parse(
      ((global.fetch as jest.Mock).mock.calls[0][1] as { body: string }).body,
    )
    expect(body).toMatchObject({
      market: "NASDAQ",
      code: "AAPL",
      name: "Apple Computer",
      category: "EQUITY",
    })
  })

  it("closes when the backdrop/Esc handler fires", () => {
    const onClose = jest.fn()
    render(<AssetAdminDialog assetId="a1" onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
