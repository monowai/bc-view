import { renderHook, act } from "@testing-library/react"
import { useDialogSubmit } from "../useDialogSubmit"

describe("useDialogSubmit", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("initializes with default state", () => {
    const { result } = renderHook(() => useDialogSubmit())
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.submitError).toBeNull()
    expect(result.current.submitSuccess).toBe(false)
  })

  it("sets submitSuccess after async operation completes", async () => {
    const { result } = renderHook(() => useDialogSubmit())

    await act(async () => {
      await result.current.handleSubmit(async () => {})
    })

    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.submitSuccess).toBe(true)
  })

  it("sets submitError on failure", async () => {
    const { result } = renderHook(() => useDialogSubmit())

    await act(async () => {
      await result.current.handleSubmit(() => {
        throw new Error("Network failure")
      })
    })

    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.submitError).toBe("Network failure")
    expect(result.current.submitSuccess).toBe(false)
  })

  it("uses fallbackError for non-Error throws", async () => {
    const { result } = renderHook(() =>
      useDialogSubmit({ fallbackError: "Custom fallback" }),
    )

    await act(async () => {
      await result.current.handleSubmit(() => {
        throw "string error"
      })
    })

    expect(result.current.submitError).toBe("Custom fallback")
  })

  it("calls onSuccess after autoCloseDelay on success", async () => {
    const onSuccess = jest.fn()
    const { result } = renderHook(() =>
      useDialogSubmit({ onSuccess, autoCloseDelay: 500 }),
    )

    await act(async () => {
      await result.current.handleSubmit(async () => {})
    })

    expect(onSuccess).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("calls onSuccess immediately when autoCloseDelay is 0", async () => {
    const onSuccess = jest.fn()
    const { result } = renderHook(() =>
      useDialogSubmit({ onSuccess, autoCloseDelay: 0 }),
    )

    await act(async () => {
      await result.current.handleSubmit(async () => {})
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it("does not call onSuccess on failure", async () => {
    const onSuccess = jest.fn()
    const { result } = renderHook(() => useDialogSubmit({ onSuccess }))

    await act(async () => {
      await result.current.handleSubmit(() => {
        throw new Error("fail")
      })
    })

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("reset clears all state", async () => {
    const { result } = renderHook(() => useDialogSubmit())

    await act(async () => {
      await result.current.handleSubmit(() => {
        throw new Error("fail")
      })
    })

    expect(result.current.submitError).toBe("fail")

    act(() => {
      result.current.reset()
    })

    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.submitError).toBeNull()
    expect(result.current.submitSuccess).toBe(false)
  })

  it("setError sets a custom error message", () => {
    const { result } = renderHook(() => useDialogSubmit())

    act(() => {
      result.current.setError("Custom error")
    })

    expect(result.current.submitError).toBe("Custom error")
  })

  it("clears previous error on new submit", async () => {
    const { result } = renderHook(() => useDialogSubmit())

    await act(async () => {
      await result.current.handleSubmit(() => {
        throw new Error("first error")
      })
    })

    expect(result.current.submitError).toBe("first error")

    await act(async () => {
      await result.current.handleSubmit(async () => {})
    })

    expect(result.current.submitError).toBeNull()
    expect(result.current.submitSuccess).toBe(true)
  })
})
