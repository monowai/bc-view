import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import IndependencePlanSwitcher from "../IndependencePlanSwitcher"
import { useActiveIndependencePlan } from "@hooks/useIndependencePlans"
import type { IndependencePlan } from "types/independence"

jest.mock("@hooks/useIndependencePlans", () => ({
  useActiveIndependencePlan: jest.fn(),
}))

const mockHook = useActiveIndependencePlan as jest.MockedFunction<
  typeof useActiveIndependencePlan
>

function makeJourney(
  overrides: Partial<IndependencePlan> = {},
): IndependencePlan {
  return {
    id: "j1",
    ownerId: "owner-1",
    name: "With Property",
    isPrimary: false,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  }
}

interface HookOverrides {
  plans?: IndependencePlan[]
  activeId?: string
  isLoading?: boolean
}

function mockSwitcher(overrides: HookOverrides = {}): {
  setActivePlan: jest.Mock
  create: jest.Mock
  update: jest.Mock
  duplicate: jest.Mock
  setPrimary: jest.Mock
  remove: jest.Mock
} {
  const plans = overrides.plans ?? []
  const activePlan = plans.find((p) => p.id === overrides.activeId) ?? plans[0]
  const fns = {
    setActivePlan: jest.fn(),
    create: jest.fn().mockResolvedValue(makeJourney({ id: "created" })),
    update: jest.fn().mockResolvedValue(makeJourney()),
    duplicate: jest.fn().mockResolvedValue(makeJourney({ id: "copy" })),
    setPrimary: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  }
  mockHook.mockReturnValue({
    plans,
    error: undefined,
    isLoading: overrides.isLoading ?? false,
    mutate: jest.fn(),
    activePlan,
    activePlanId: activePlan?.id,
    ...fns,
  } as unknown as ReturnType<typeof useActiveIndependencePlan>)
  return fns
}

describe("IndependencePlanSwitcher", () => {
  beforeEach(() => mockHook.mockReset())

  it("renders nothing when the user owns no plans", () => {
    mockSwitcher({ plans: [] })
    const { container } = render(<IndependencePlanSwitcher />)
    expect(container).toBeEmptyDOMElement()
  })

  it("offers only a quiet create affordance when the user owns one plan", () => {
    mockSwitcher({ plans: [makeJourney()] })
    render(<IndependencePlanSwitcher />)

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull()
    expect(
      screen.getByRole("button", { name: /Add a plan to compare/ }),
    ).toBeInTheDocument()
  })

  it("lists every plan and marks the default one", () => {
    mockSwitcher({
      plans: [
        makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
        makeJourney({ id: "j2", name: "No Property" }),
      ],
      activeId: "j2",
    })
    render(<IndependencePlanSwitcher />)

    const select = screen.getByLabelText("Plan") as HTMLSelectElement
    expect(select).toHaveValue("j2")
    expect(
      screen.getByRole("option", { name: "With Property (default)" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "No Property" }),
    ).toBeInTheDocument()
  })

  it("switches to the chosen plan", async () => {
    const { setActivePlan } = mockSwitcher({
      plans: [
        makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
        makeJourney({ id: "j2", name: "No Property" }),
      ],
      activeId: "j1",
    })
    render(<IndependencePlanSwitcher />)

    await userEvent.selectOptions(screen.getByLabelText("Plan"), "j2")

    expect(setActivePlan).toHaveBeenCalledWith("j2")
  })

  it("renames the active plan", async () => {
    const { update } = mockSwitcher({
      plans: [
        makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
        makeJourney({ id: "j2", name: "No Property" }),
      ],
      activeId: "j2",
    })
    render(<IndependencePlanSwitcher />)

    await userEvent.click(screen.getByRole("button", { name: /Rename/ }))
    const input = screen.getByLabelText("Plan name")
    expect(input).toHaveValue("No Property")
    await userEvent.clear(input)
    await userEvent.type(input, "Renting")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(update).toHaveBeenCalledWith("j2", { name: "Renting" })
  })

  it("duplicates the active plan and switches to the copy", async () => {
    const { duplicate, setActivePlan } = mockSwitcher({
      plans: [
        makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
        makeJourney({ id: "j2", name: "No Property" }),
      ],
      activeId: "j1",
    })
    render(<IndependencePlanSwitcher />)

    await userEvent.click(screen.getByRole("button", { name: /Duplicate/ }))
    await userEvent.click(screen.getByRole("button", { name: "Copy" }))

    expect(duplicate).toHaveBeenCalledWith("j1", {
      name: "With Property (copy)",
    })
    expect(setActivePlan).toHaveBeenCalledWith("copy")
  })

  it("offers 'make default' only when the active plan isn't already the default", async () => {
    const { setPrimary } = mockSwitcher({
      plans: [
        makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
        makeJourney({ id: "j2", name: "No Property" }),
      ],
      activeId: "j2",
    })
    const { rerender } = render(<IndependencePlanSwitcher />)

    await userEvent.click(screen.getByRole("button", { name: /Make default/ }))
    expect(setPrimary).toHaveBeenCalledWith("j2")

    mockSwitcher({
      plans: [
        makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
        makeJourney({ id: "j2", name: "No Property" }),
      ],
      activeId: "j1",
    })
    rerender(<IndependencePlanSwitcher />)
    expect(
      screen.queryByRole("button", { name: /Make default/ }),
    ).not.toBeInTheDocument()
  })

  it("deletes the active plan after confirmation", async () => {
    const { remove } = mockSwitcher({
      plans: [
        makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
        makeJourney({ id: "j2", name: "No Property" }),
      ],
      activeId: "j2",
    })
    render(<IndependencePlanSwitcher />)

    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(screen.getByText(/Its phases are kept and detached/)).toBeVisible()
    // Toolbar button and the confirm dialog's button share the label; the
    // dialog's is the one rendered last.
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" })
    await userEvent.click(deleteButtons[deleteButtons.length - 1])

    expect(remove).toHaveBeenCalledWith("j2")
  })
})
