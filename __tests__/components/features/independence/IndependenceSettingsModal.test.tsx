import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceSettingsModal from "@components/features/independence/IndependenceSettingsModal"

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: {
      yearOfBirth: 1980,
      monthOfBirth: 6,
      targetIndependenceAge: 60,
      lifeExpectancy: 85,
    },
    updateSettings: jest.fn(),
  }),
}))

jest.mock("@components/ui/MathInput", () => ({
  __esModule: true,
  default: ({ onChange, value, ...rest }: any) => (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      {...rest}
    />
  ),
}))

describe("IndependenceSettingsModal", () => {
  it("renders title when isOpen=true", () => {
    render(<IndependenceSettingsModal isOpen={true} onClose={jest.fn()} />)
    expect(screen.getByText("Independence Settings")).toBeInTheDocument()
  })

  it("returns null when isOpen=false", () => {
    const { container } = render(
      <IndependenceSettingsModal isOpen={false} onClose={jest.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("calls onClose on Escape", () => {
    const onClose = jest.fn()
    render(<IndependenceSettingsModal isOpen={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })

  it("shows validation error when lifeExpectancy is set below targetIndependenceAge", async () => {
    render(<IndependenceSettingsModal isOpen={true} onClose={jest.fn()} />)
    // Set life expectancy to 0 (below the target independence age of 60)
    const lifeInput = screen.getByRole("spinbutton", {
      name: /life expectancy/i,
    })
    fireEvent.change(lifeInput, { target: { value: "0" } })
    const saveBtn = screen.getByRole("button", { name: /save settings/i })
    fireEvent.click(saveBtn)
    expect(
      await screen.findByText(
        "Life expectancy must be after target independence age",
      ),
    ).toBeInTheDocument()
  })
})
