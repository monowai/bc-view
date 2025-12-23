import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import DateInput from "../DateInput"

describe("DateInput", () => {
  it("renders with initial value", () => {
    render(<DateInput value="2024-01-15" onChange={jest.fn()} />)
    expect(screen.getByDisplayValue("2024-01-15")).toBeInTheDocument()
  })

  it("calls onChange when date is changed via picker", () => {
    const onChange = jest.fn()
    render(<DateInput value="2024-01-15" onChange={onChange} />)

    fireEvent.change(screen.getByDisplayValue("2024-01-15"), {
      target: { value: "2024-01-20" },
    })

    expect(onChange).toHaveBeenCalledWith("2024-01-20")
  })

  describe("day adjustment (+/-)", () => {
    it("goes back one day when - is pressed", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), { key: "-" })

      expect(onChange).toHaveBeenCalledWith("2024-01-14")
    })

    it("goes forward one day when + is pressed", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), { key: "+" })

      expect(onChange).toHaveBeenCalledWith("2024-01-16")
    })

    it("goes forward one day when = is pressed (unshifted +)", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), { key: "=" })

      expect(onChange).toHaveBeenCalledWith("2024-01-16")
    })
  })

  describe("month adjustment (Shift + +/-)", () => {
    it("goes back one month when Shift+- is pressed", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-03-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-03-15"), {
        key: "-",
        shiftKey: true,
      })

      expect(onChange).toHaveBeenCalledWith("2024-02-15")
    })

    it("goes forward one month when Shift++ is pressed", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), {
        key: "+",
        shiftKey: true,
      })

      expect(onChange).toHaveBeenCalledWith("2024-02-15")
    })
  })

  describe("year adjustment (Ctrl/Cmd + +/-)", () => {
    it("goes back one year when Ctrl+- is pressed", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), {
        key: "-",
        ctrlKey: true,
      })

      expect(onChange).toHaveBeenCalledWith("2023-01-15")
    })

    it("goes forward one year when Ctrl++ is pressed", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), {
        key: "+",
        ctrlKey: true,
      })

      expect(onChange).toHaveBeenCalledWith("2025-01-15")
    })

    it("goes back one year when Cmd+- is pressed (Mac)", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), {
        key: "-",
        metaKey: true,
      })

      expect(onChange).toHaveBeenCalledWith("2023-01-15")
    })
  })

  describe("today shortcut (T)", () => {
    beforeEach(() => {
      // Mock today's date
      jest.useFakeTimers()
      jest.setSystemTime(new Date("2024-06-15"))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("sets date to today when t is pressed", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), { key: "t" })

      expect(onChange).toHaveBeenCalledWith("2024-06-15")
    })

    it("sets date to today when T is pressed", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), { key: "T" })

      expect(onChange).toHaveBeenCalledWith("2024-06-15")
    })
  })

  describe("arrow keys use native behavior", () => {
    it("does not intercept ArrowUp", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), {
        key: "ArrowUp",
      })

      // Should not call onChange - let browser handle it
      expect(onChange).not.toHaveBeenCalled()
    })

    it("does not intercept ArrowDown", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), {
        key: "ArrowDown",
      })

      // Should not call onChange - let browser handle it
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe("edge cases", () => {
    it("handles month boundary going backward", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-02-01" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-02-01"), { key: "-" })

      expect(onChange).toHaveBeenCalledWith("2024-01-31")
    })

    it("handles month boundary going forward", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-31" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-31"), { key: "+" })

      expect(onChange).toHaveBeenCalledWith("2024-02-01")
    })

    it("handles year boundary going backward", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-01" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-01"), { key: "-" })

      expect(onChange).toHaveBeenCalledWith("2023-12-31")
    })

    it("handles year boundary going forward", () => {
      const onChange = jest.fn()
      render(<DateInput value="2023-12-31" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2023-12-31"), { key: "+" })

      expect(onChange).toHaveBeenCalledWith("2024-01-01")
    })

    it("handles leap year", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-02-28" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-02-28"), { key: "+" })

      expect(onChange).toHaveBeenCalledWith("2024-02-29")
    })

    it("handles month wrap with Shift", () => {
      const onChange = jest.fn()
      render(<DateInput value="2024-01-15" onChange={onChange} />)

      fireEvent.keyDown(screen.getByDisplayValue("2024-01-15"), {
        key: "-",
        shiftKey: true,
      })

      expect(onChange).toHaveBeenCalledWith("2023-12-15")
    })
  })
})
