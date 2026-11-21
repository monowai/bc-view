import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceSettingsModal from "@components/features/independence/IndependenceSettingsModal"

const WORKING_SETTINGS = {
  yearOfBirth: 1980,
  monthOfBirth: 6,
  targetIndependenceAge: 60,
  lifeExpectancy: 85,
  retiredOn: null as string | null,
}
let mockSettings = { ...WORKING_SETTINGS }
const mockUpdateSettings = jest.fn()

jest.mock("@components/features/independence/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
  }),
}))

beforeEach(() => {
  mockSettings = { ...WORKING_SETTINGS }
  mockUpdateSettings.mockReset()
  mockUpdateSettings.mockResolvedValue(undefined)
})

/** yyyy-MM-dd for a date `days` from today, in local time. */
function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

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

  describe("I'm retired", () => {
    it("swaps the target age for a retired-on date when ticked", () => {
      render(<IndependenceSettingsModal isOpen={true} onClose={jest.fn()} />)
      expect(screen.queryByLabelText(/retired on/i)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("checkbox", { name: /i'm retired/i }))
      expect(screen.getByLabelText(/retired on/i)).toHaveAttribute(
        "max",
        isoDaysFromToday(0),
      )
      expect(
        screen.queryByLabelText(/target independence age/i),
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(/your plan treats you as retired from this date/i),
      ).toBeInTheDocument()
    })

    it("saves retired with the retired-on date", async () => {
      const onClose = jest.fn()
      render(<IndependenceSettingsModal isOpen={true} onClose={onClose} />)
      fireEvent.click(screen.getByRole("checkbox", { name: /i'm retired/i }))
      fireEvent.change(screen.getByLabelText(/retired on/i), {
        target: { value: "2024-03-01" },
      })
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }))
      await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled())
      const request = mockUpdateSettings.mock.calls[0][0]
      expect(request).toMatchObject({ retired: true, retiredOn: "2024-03-01" })
      // The stored target age is left alone so unticking restores it.
      expect(request).not.toHaveProperty("targetIndependenceAge")
    })

    it("sends retired: false when the box is unticked", async () => {
      mockSettings = { ...WORKING_SETTINGS, retiredOn: "2024-03-01" }
      render(<IndependenceSettingsModal isOpen={true} onClose={jest.fn()} />)
      const box = screen.getByRole("checkbox", { name: /i'm retired/i })
      expect(box).toBeChecked()
      expect(screen.getByLabelText(/retired on/i)).toHaveValue("2024-03-01")
      fireEvent.click(box)
      expect(screen.getByLabelText(/target independence age/i)).toHaveValue(60)
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }))
      await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled())
      const request = mockUpdateSettings.mock.calls[0][0]
      expect(request.retired).toBe(false)
      expect(request).not.toHaveProperty("retiredOn")
      expect(request.targetIndependenceAge).toBe(60)
    })

    it("leaves retirement untouched when the box was never ticked", async () => {
      render(<IndependenceSettingsModal isOpen={true} onClose={jest.fn()} />)
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }))
      await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled())
      expect(mockUpdateSettings.mock.calls[0][0]).not.toHaveProperty("retired")
    })

    it("rejects a retired-on date in the future", async () => {
      render(<IndependenceSettingsModal isOpen={true} onClose={jest.fn()} />)
      fireEvent.click(screen.getByRole("checkbox", { name: /i'm retired/i }))
      fireEvent.change(screen.getByLabelText(/retired on/i), {
        target: { value: isoDaysFromToday(30) },
      })
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }))
      expect(
        await screen.findByText("Retired on date cannot be in the future"),
      ).toBeInTheDocument()
      expect(mockUpdateSettings).not.toHaveBeenCalled()
    })

    it("requires a retired-on date when ticked", async () => {
      render(<IndependenceSettingsModal isOpen={true} onClose={jest.fn()} />)
      fireEvent.click(screen.getByRole("checkbox", { name: /i'm retired/i }))
      fireEvent.click(screen.getByRole("button", { name: /save settings/i }))
      expect(
        await screen.findByText("Retired on date is required"),
      ).toBeInTheDocument()
      expect(mockUpdateSettings).not.toHaveBeenCalled()
    })
  })
})
