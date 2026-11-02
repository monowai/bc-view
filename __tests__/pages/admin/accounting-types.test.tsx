import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import AccountingTypesPageDefault from "@pages/admin/accounting-types"

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ admin: true, isLoading: false }),
}))

const Page = AccountingTypesPageDefault as React.ComponentType

const equity = {
  id: "at-1",
  category: "EQUITY",
  currency: { code: "USD", name: "US Dollar" },
  boardLot: 100,
  settlementDays: 2,
}

interface Reply {
  ok: boolean
  body?: unknown
}

function stubFetch(
  types: unknown[],
  write: Reply = { ok: true, body: {} },
): jest.Mock {
  const mock = jest.fn((url: string, init?: RequestInit) => {
    if (init?.method) {
      return Promise.resolve({
        ok: write.ok,
        json: () => Promise.resolve(write.body ?? {}),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: url.includes("currencies")
            ? [{ code: "USD", name: "US Dollar" }]
            : types,
        }),
    })
  })
  global.fetch = mock as unknown as typeof fetch
  return mock
}

const confirmDelete = (): HTMLElement =>
  screen.getAllByRole("button", { name: "Delete" }).at(-1) as HTMLElement

const writes = (mock: jest.Mock): [string, RequestInit][] =>
  mock.mock.calls.filter((c) => c[1]?.method) as [string, RequestInit][]

describe("accounting types admin", () => {
  it("should show the empty state when no types exist", async () => {
    stubFetch([])
    render(<Page />)
    expect(
      await screen.findByText("No accounting types defined yet"),
    ).toBeInTheDocument()
  })

  it("should list a type with its board lot and settlement days", async () => {
    stubFetch([equity])
    render(<Page />)
    expect(await screen.findByText("EQUITY")).toBeInTheDocument()
    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("should keep Save disabled until category and currency are set, then POST", async () => {
    const mock = stubFetch([])
    render(<Page />)
    await screen.findByText("No accounting types defined yet")

    fireEvent.click(screen.getByRole("button", { name: /New Type/ }))
    expect(screen.getByText("Create Accounting Type")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /New Type/ })).toBeNull()
    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeDisabled()
    expect(save).toHaveClass("bg-gray-400", "cursor-not-allowed")

    fireEvent.change(screen.getByPlaceholderText("e.g., EQUITY"), {
      target: { value: " BOND " },
    })
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "USD" },
    })
    expect(save).toBeEnabled()
    expect(save).toHaveClass("bg-blue-500")

    fireEvent.click(save)
    await waitFor(() =>
      expect(screen.queryByText("Create Accounting Type")).toBeNull(),
    )
    const [url, init] = writes(mock)[0]
    expect(url).toBe("/api/admin/accounting-types")
    expect(JSON.parse(init.body as string)).toEqual({
      category: "BOND",
      currency: "USD",
      boardLot: 1,
      settlementDays: 1,
    })
  })

  it("should PATCH only the mutable fields on edit ", async () => {
    const mock = stubFetch([equity])
    render(<Page />)
    fireEvent.click(await screen.findByTitle("Edit"))

    expect(
      screen.getByText(
        "Category and currency cannot be changed after creation.",
      ),
    ).toBeInTheDocument()
    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeEnabled()
    fireEvent.click(save)

    await waitFor(() => expect(writes(mock)).toHaveLength(1))
    const [url, init] = writes(mock)[0]
    expect(url).toBe("/api/admin/accounting-types/at-1")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body as string)).toEqual({
      boardLot: 100,
      settlementDays: 2,
    })
  })

  it("should close the form on Cancel", async () => {
    stubFetch([equity])
    render(<Page />)
    fireEvent.click(await screen.findByTitle("Edit"))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByText("Edit Accounting Type")).toBeNull()
    expect(screen.getByRole("button", { name: /New Type/ })).toBeInTheDocument()
  })

  it("should warn about referencing assets, DELETE, and confirm", async () => {
    const mock = stubFetch([equity])
    render(<Page />)
    fireEvent.click(await screen.findByTitle("Delete"))

    expect(
      screen.getByText(
        'Are you sure you want to delete "EQUITY (USD)"? This will fail if assets reference it.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(confirmDelete())

    expect(
      await screen.findByText('Deleted "EQUITY (USD)"'),
    ).toBeInTheDocument()
    const [url, init] = writes(mock)[0]
    expect(url).toBe("/api/admin/accounting-types/at-1")
    expect(init.method).toBe("DELETE")
  })

  it("should close the dialog and report when a delete is refused", async () => {
    stubFetch([equity], { ok: false, body: { detail: "In use" } })
    render(<Page />)
    fireEvent.click(await screen.findByTitle("Delete"))
    fireEvent.click(confirmDelete())

    expect(await screen.findByText("In use")).toBeInTheDocument()
    expect(screen.queryByText("Delete Accounting Type?")).toBeNull()
  })
})
