import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import ScenariosPageDefault from "@pages/admin/scenarios"

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ admin: true, isLoading: false }),
}))

const Page = ScenariosPageDefault as React.ComponentType

const scenario = {
  id: "s-1",
  name: "Conservative",
  description: "Lower returns",
  sortOrder: 1,
  retirementAgeOffset: 2,
  expensesPercent: 100,
  returnRateOffset: -2,
  inflationOffset: 0,
  contributionPercent: 100,
}

function stubFetch(
  scenarios: unknown[],
  write: { ok: boolean; body?: unknown } = { ok: true, body: {} },
): jest.Mock {
  const mock = jest.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method
        ? { ok: write.ok, json: () => Promise.resolve(write.body ?? {}) }
        : { ok: true, json: () => Promise.resolve({ data: scenarios }) },
    ),
  )
  global.fetch = mock as unknown as typeof fetch
  return mock
}

const confirmDelete = (): HTMLElement =>
  screen.getAllByRole("button", { name: "Delete" }).at(-1) as HTMLElement

const writes = (mock: jest.Mock): [string, RequestInit][] =>
  mock.mock.calls.filter((c) => c[1]?.method) as [string, RequestInit][]

describe("quick scenarios admin", () => {
  it("should show the empty state when no scenarios exist", async () => {
    stubFetch([])
    render(<Page />)
    expect(
      await screen.findByText("No scenarios defined yet"),
    ).toBeInTheDocument()
  })

  it("should show only the adjustments that differ from neutral", async () => {
    stubFetch([scenario])
    render(<Page />)
    expect(await screen.findByText("Conservative")).toBeInTheDocument()
    expect(screen.getByText(/Age \+/)).toBeInTheDocument()
    expect(screen.getByText(/Return/)).toBeInTheDocument()
    expect(screen.queryByText(/Exp /)).toBeNull()
    expect(screen.queryByText(/Infl/)).toBeNull()
  })

  it("should keep Save disabled until named, then POST", async () => {
    const mock = stubFetch([])
    render(<Page />)
    await screen.findByText("No scenarios defined yet")

    fireEvent.click(screen.getByRole("button", { name: /New Scenario/ }))
    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText("e.g., Conservative"), {
      target: { value: "Lean" },
    })
    expect(save).toBeEnabled()
    fireEvent.click(save)

    await waitFor(() =>
      expect(screen.queryByText("Create Scenario")).toBeNull(),
    )
    const [url, init] = writes(mock)[0]
    expect(url).toBe("/api/admin/scenarios")
    expect(init.method).toBe("POST")
  })

  it("should PATCH on edit", async () => {
    const mock = stubFetch([scenario])
    render(<Page />)
    fireEvent.click(await screen.findByTitle("Edit"))
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(writes(mock)).toHaveLength(1))
    const [url, init] = writes(mock)[0]
    expect(url).toBe("/api/admin/scenarios/s-1")
    expect(init.method).toBe("PATCH")
  })

  it("should DELETE after confirmation and report it", async () => {
    const mock = stubFetch([scenario])
    render(<Page />)
    fireEvent.click(await screen.findByTitle("Delete"))

    expect(
      screen.getByText('Are you sure you want to delete "Conservative"?'),
    ).toBeInTheDocument()
    fireEvent.click(confirmDelete())

    expect(
      await screen.findByText('Scenario "Conservative" deleted'),
    ).toBeInTheDocument()
    expect(writes(mock)[0][0]).toBe("/api/admin/scenarios/s-1")
  })

  it("should leave the dialog open when a delete is refused", async () => {
    stubFetch([scenario], { ok: false, body: { error: "Nope" } })
    render(<Page />)
    fireEvent.click(await screen.findByTitle("Delete"))
    fireEvent.click(confirmDelete())

    expect(await screen.findByText("Nope")).toBeInTheDocument()
    expect(screen.getByText("Delete Scenario?")).toBeInTheDocument()
  })
})
