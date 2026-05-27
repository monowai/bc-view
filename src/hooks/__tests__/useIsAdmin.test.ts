import { renderHook, waitFor } from "@testing-library/react"
import { useUser } from "@auth0/nextjs-auth0/client"
import { useIsAdmin } from "../useIsAdmin"

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>
const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

const fakeUser = {
  sub: "auth0|x",
  email: "x@y",
  email_verified: true,
} as unknown as Parameters<typeof mockUseUser.mockReturnValue>[0]["user"]

describe("useIsAdmin", () => {
  beforeEach(() => {
    mockUseUser.mockReset()
    errorSpy.mockClear()
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  it("skips fetch when no user", async () => {
    mockUseUser.mockReturnValue({
      user: undefined,
      error: undefined,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)

    const { result } = renderHook(() => useIsAdmin())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAdmin).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("calls admin-check when user present", async () => {
    mockUseUser.mockReturnValue({
      user: fakeUser,
      error: null,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ isAdmin: true }),
    })

    const { result } = renderHook(() => useIsAdmin())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/admin-check")
    expect(result.current.isAdmin).toBe(true)
  })

  it("treats 401 silently", async () => {
    mockUseUser.mockReturnValue({
      user: fakeUser,
      error: null,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    })

    const { result } = renderHook(() => useIsAdmin())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAdmin).toBe(false)
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
