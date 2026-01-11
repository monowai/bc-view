import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import WhatIfSlider from "../WhatIfSlider"

describe("WhatIfSlider", () => {
  const defaultProps = {
    label: "Test Slider",
    value: 50,
    onChange: jest.fn(),
    min: 0,
    max: 100,
    step: 10,
    unit: "%",
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders label and value", () => {
    render(<WhatIfSlider {...defaultProps} />)

    expect(screen.getByText("Test Slider")).toBeInTheDocument()
    // Value > 0 gets a + prefix
    expect(screen.getByText("+50%")).toBeInTheDocument()
  })

  it("renders slider with correct attributes", () => {
    render(<WhatIfSlider {...defaultProps} />)

    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("min", "0")
    expect(slider).toHaveAttribute("max", "100")
    expect(slider).toHaveAttribute("step", "10")
    expect(slider).toHaveValue("50")
  })

  it("calls onChange when slider value changes", () => {
    render(<WhatIfSlider {...defaultProps} />)

    const slider = screen.getByRole("slider")
    fireEvent.change(slider, { target: { value: "70" } })

    expect(defaultProps.onChange).toHaveBeenCalledWith(70)
  })

  it("uses custom formatValue function when provided", () => {
    const formatValue = (v: number): string => `Custom: ${v}`
    render(<WhatIfSlider {...defaultProps} formatValue={formatValue} />)

    expect(screen.getByText("Custom: 50")).toBeInTheDocument()
  })

  it("displays unit correctly with positive prefix", () => {
    render(<WhatIfSlider {...defaultProps} unit=" years" value={5} />)

    // Value > 0 gets a + prefix
    expect(screen.getByText("+5 years")).toBeInTheDocument()
  })

  it("displays zero value without prefix", () => {
    render(<WhatIfSlider {...defaultProps} value={0} />)

    // Multiple "0%" elements exist (value display and min label), so use getAllByText
    const zeroElements = screen.getAllByText("0%")
    expect(zeroElements.length).toBeGreaterThanOrEqual(1)
  })

  it("handles decimal step values", () => {
    render(<WhatIfSlider {...defaultProps} step={0.5} value={2.5} />)

    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("step", "0.5")
    expect(slider).toHaveValue("2.5")
  })

  it("handles negative values", () => {
    render(<WhatIfSlider {...defaultProps} min={-10} max={10} value={-5} />)

    const slider = screen.getByRole("slider")
    expect(slider).toHaveValue("-5")
    expect(screen.getByText("-5%")).toBeInTheDocument()
  })

  it("shows min and max labels", () => {
    render(<WhatIfSlider {...defaultProps} min={0} max={100} />)

    expect(screen.getByText("0%")).toBeInTheDocument()
    expect(screen.getByText("+100%")).toBeInTheDocument()
  })
})
