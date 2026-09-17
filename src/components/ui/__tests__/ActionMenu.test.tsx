import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ActionMenu, { ActionMenuItem } from "../ActionMenu"

const items = (overrides: Partial<ActionMenuItem>[] = []): ActionMenuItem[] => [
  { label: "Rename this plan", onSelect: jest.fn(), ...overrides[0] },
  { label: "Duplicate this plan", onSelect: jest.fn(), ...overrides[1] },
  {
    label: "Delete this plan",
    destructive: true,
    onSelect: jest.fn(),
    ...overrides[2],
  },
]

const openMenu = async (): Promise<void> => {
  await userEvent.click(screen.getByRole("button", { name: "More actions" }))
}

describe("ActionMenu", () => {
  it("renders nothing when there is nothing to offer", () => {
    const { container } = render(<ActionMenu items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("opens on click and runs the chosen action", async () => {
    const list = items()
    render(<ActionMenu items={list} />)
    await openMenu()

    await userEvent.click(
      screen.getByRole("menuitem", { name: /Duplicate this plan/ }),
    )
    expect(list[1].onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("moves focus into the menu on open", async () => {
    // Declaring role="menu" promises keyboard navigation. A div of buttons
    // that only answers to Tab is worse than not claiming the role.
    render(<ActionMenu items={items()} />)
    await openMenu()

    expect(screen.getByRole("menuitem", { name: /Rename/ })).toHaveFocus()
  })

  it("navigates with the arrow keys, wrapping at both ends", async () => {
    render(<ActionMenu items={items()} />)
    await openMenu()

    await userEvent.keyboard("{ArrowDown}")
    expect(screen.getByRole("menuitem", { name: /Duplicate/ })).toHaveFocus()

    await userEvent.keyboard("{ArrowUp}{ArrowUp}")
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveFocus()

    await userEvent.keyboard("{ArrowDown}")
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toHaveFocus()
  })

  it("jumps to the ends with Home and End", async () => {
    render(<ActionMenu items={items()} />)
    await openMenu()

    await userEvent.keyboard("{End}")
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveFocus()

    await userEvent.keyboard("{Home}")
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toHaveFocus()
  })

  it("returns focus to the trigger on Escape", async () => {
    render(<ActionMenu items={items()} />)
    await openMenu()

    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus()
  })

  it("keeps two actions sharing a label distinct", async () => {
    // Keying by label made React reconcile the wrong row when two items were
    // both called "Delete".
    const first = jest.fn()
    const second = jest.fn()
    render(
      <ActionMenu
        items={[
          { label: "Delete", onSelect: first },
          { label: "Delete", onSelect: second, destructive: true },
        ]}
      />,
    )
    await openMenu()

    const both = screen.getAllByRole("menuitem", { name: "Delete" })
    expect(both).toHaveLength(2)
    await userEvent.click(both[1])
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it("does not fire a disabled action", async () => {
    const list = items([{}, {}, { disabled: true }])
    render(<ActionMenu items={list} />)
    await openMenu()

    const del = screen.getByRole("menuitem", { name: /Delete/ })
    expect(del).toBeDisabled()
    await userEvent.click(del)
    expect(list[2].onSelect).not.toHaveBeenCalled()
  })

  it("closes when the user clicks away", async () => {
    render(
      <div>
        <ActionMenu items={items()} />
        <button type="button">elsewhere</button>
      </div>,
    )
    await openMenu()
    await userEvent.click(screen.getByRole("button", { name: "elsewhere" }))

    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
})
