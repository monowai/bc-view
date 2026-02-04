import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import MathInput from "../MathInput"

describe("MathInput component", () => {
  describe("decimal input", () => {
    it("preserves decimal point while typing", () => {
      const onChange = jest.fn()
      render(<MathInput value={0} onChange={onChange} />)

      const input = screen.getByRole("textbox") as HTMLInputElement

      // Focus the input
      fireEvent.focus(input)

      // Type "1" — onChange(1)
      fireEvent.change(input, { target: { value: "1" } })
      expect(input.value).toBe("1")
      expect(onChange).toHaveBeenLastCalledWith(1)

      // Type "1." — parseFloat("1.") = 1, but display should keep the dot
      fireEvent.change(input, { target: { value: "1." } })
      expect(input.value).toBe("1.")

      // Type "1.0" — parseFloat("1.0") = 1, display should keep "1.0"
      fireEvent.change(input, { target: { value: "1.0" } })
      expect(input.value).toBe("1.0")

      // Type "1.09" — parseFloat("1.09") = 1.09
      fireEvent.change(input, { target: { value: "1.09" } })
      expect(input.value).toBe("1.09")
      expect(onChange).toHaveBeenLastCalledWith(1.09)
    })

    it("syncs display value from external changes when not focused", () => {
      const onChange = jest.fn()
      const { rerender } = render(<MathInput value={0} onChange={onChange} />)

      const input = screen.getByRole("textbox") as HTMLInputElement
      expect(input.value).toBe("")

      // External value change without focus
      rerender(<MathInput value={5.5} onChange={onChange} />)
      expect(input.value).toBe("5.5")
    })

    it("does not overwrite user input from external value while focused", () => {
      const onChange = jest.fn()
      const { rerender } = render(<MathInput value={0} onChange={onChange} />)

      const input = screen.getByRole("textbox") as HTMLInputElement

      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: "2." } })
      expect(input.value).toBe("2.")

      // Parent re-renders with value=2 (parseFloat("2.") = 2)
      rerender(<MathInput value={2} onChange={onChange} />)

      // Display should still show "2." not "2"
      expect(input.value).toBe("2.")
    })

    it("syncs display on blur", () => {
      const onChange = jest.fn()
      render(<MathInput value={0} onChange={onChange} />)

      const input = screen.getByRole("textbox") as HTMLInputElement

      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: "3.50" } })
      expect(input.value).toBe("3.50")

      // On blur, expression is evaluated and display is updated
      fireEvent.blur(input)
      expect(onChange).toHaveBeenLastCalledWith(3.5)
    })
  })
})
