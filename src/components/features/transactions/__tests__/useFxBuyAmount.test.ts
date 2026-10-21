import { act, renderHook } from "@testing-library/react"
import { useFxBuyAmount } from "../useFxBuyAmount"

interface Props {
  sellAmount: number
  fxRate: number | null
  enabled?: boolean
}

const setup = (
  initial: Props,
): {
  onBuyAmount: jest.Mock
  result: { current: ReturnType<typeof useFxBuyAmount> }
  rerender: (props: Props) => void
} => {
  const onBuyAmount = jest.fn()
  const { result, rerender } = renderHook(
    (props: Props) => useFxBuyAmount({ ...props, onBuyAmount }),
    { initialProps: initial },
  )
  return { onBuyAmount, result, rerender }
}

describe("useFxBuyAmount", () => {
  it("sets the buy amount to sell x rate, rounded to 2dp", () => {
    const { onBuyAmount } = setup({ sellAmount: 33.33, fxRate: 1.2 })
    expect(onBuyAmount).toHaveBeenLastCalledWith(40)
  })

  it("recomputes when the sell amount or rate changes", () => {
    const { onBuyAmount, rerender } = setup({ sellAmount: 1000, fxRate: 1.5 })
    expect(onBuyAmount).toHaveBeenLastCalledWith(1500)
    rerender({ sellAmount: 100, fxRate: 1.555 })
    expect(onBuyAmount).toHaveBeenLastCalledWith(155.5)
  })

  it("does nothing without a rate, a positive sell amount, or when disabled", () => {
    const { onBuyAmount, rerender } = setup({ sellAmount: 1000, fxRate: null })
    rerender({ sellAmount: 0, fxRate: 1.5 })
    rerender({ sellAmount: 1000, fxRate: 1.5, enabled: false })
    expect(onBuyAmount).not.toHaveBeenCalled()
  })

  it("stops auto-calculating once the buy amount is typed, until resumed", () => {
    const { onBuyAmount, result, rerender } = setup({
      sellAmount: 1000,
      fxRate: 1.5,
    })
    act(() => result.current.overrideBuyAmount(1490))
    expect(onBuyAmount).toHaveBeenLastCalledWith(1490)
    expect(result.current.manualBuyAmount).toBe(true)

    rerender({ sellAmount: 2000, fxRate: 1.5 })
    expect(onBuyAmount).toHaveBeenLastCalledWith(1490)

    act(() => result.current.resumeAutoBuyAmount())
    expect(result.current.manualBuyAmount).toBe(false)
    expect(onBuyAmount).toHaveBeenLastCalledWith(3000)
  })
})
