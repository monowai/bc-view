import { renderHook } from "@testing-library/react"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"

describe("useCompositeProjectionContext", () => {
  it("throws when used outside provider", () => {
    // Suppress React's error boundary console output for this test
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useCompositeProjectionContext())).toThrow(
      /CompositeProjectionProvider/,
    )
    spy.mockRestore()
  })
})
