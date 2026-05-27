import { renderHook } from "@testing-library/react"
import useSwr from "swr"
import { useBuildVersion } from "../useBuildVersion"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const swrResult = (
  data: { branch: string; commit: string; build: string } | undefined,
): ReturnType<typeof useSwr> =>
  ({ data, isLoading: false, error: undefined }) as unknown as ReturnType<
    typeof useSwr
  >

describe("useBuildVersion", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
  })

  it("is not stale before any data arrives", () => {
    mockUseSwr.mockReturnValue(swrResult(undefined))
    const { result } = renderHook(() => useBuildVersion())
    expect(result.current.isStale).toBe(false)
    expect(result.current.initialBuild).toBeUndefined()
  })

  it("captures initial build and stays fresh while it matches", () => {
    mockUseSwr.mockReturnValue(
      swrResult({ branch: "main", commit: "abc", build: "100" }),
    )
    const { result, rerender } = renderHook(() => useBuildVersion())
    rerender()
    expect(result.current.initialBuild).toBe("100")
    expect(result.current.isStale).toBe(false)
  })

  it("flags stale when the build changes after first capture", () => {
    mockUseSwr.mockReturnValue(
      swrResult({ branch: "main", commit: "abc", build: "100" }),
    )
    const { result, rerender } = renderHook(() => useBuildVersion())
    rerender()
    expect(result.current.isStale).toBe(false)

    mockUseSwr.mockReturnValue(
      swrResult({ branch: "main", commit: "def", build: "101" }),
    )
    rerender()
    expect(result.current.isStale).toBe(true)
    expect(result.current.initialBuild).toBe("100")
    expect(result.current.info?.build).toBe("101")
  })

  it("does not flag stale for 'dev' build noise locally", () => {
    mockUseSwr.mockReturnValue(
      swrResult({ branch: "main", commit: "abc", build: "dev" }),
    )
    const { result, rerender } = renderHook(() => useBuildVersion())
    rerender()
    expect(result.current.isStale).toBe(false)
  })
})
