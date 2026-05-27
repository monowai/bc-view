import { renderHook, waitFor } from "@testing-library/react"
import { useUser } from "@auth0/nextjs-auth0/client"

// jest.setup.js applies a global mock for this hook so other tests get
// permissive perms. We want the real implementation here.
jest.unmock("@hooks/usePermissions")
import { usePermissions } from "../usePermissions"

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>
const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

const fakeUser = {
  sub: "auth0|x",
  email: "x@y",
  email_verified: true,
} as unknown as Parameters<typeof mockUseUser.mockReturnValue>[0]["user"]

describe("usePermissions", () => {
  beforeEach(() => {
    mockUseUser.mockReset()
    errorSpy.mockClear()
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  it("skips fetch and returns empty perms when no user", async () => {
    mockUseUser.mockReturnValue({
      user: undefined,
      error: undefined,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)

    const { result } = renderHook(() => usePermissions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.ai).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("waits while auth is loading", () => {
    mockUseUser.mockReturnValue({
      user: undefined,
      error: undefined,
      isLoading: true,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)

    const { result } = renderHook(() => usePermissions())
    expect(result.current.isLoading).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("fetches permissions when user is present", async () => {
    mockUseUser.mockReturnValue({
      user: fakeUser,
      error: null,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ai: true, preview: false, admin: false }),
    })

    const { result } = renderHook(() => usePermissions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/permissions")
    expect(result.current.ai).toBe(true)
  })

  it("treats 401 silently (no console.error)", async () => {
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

    const { result } = renderHook(() => usePermissions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.ai).toBe(false)
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
