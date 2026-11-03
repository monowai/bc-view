import React from "react"
import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  RegistrationProvider,
  useRegistration,
} from "@contexts/RegistrationContext"

const mockUseUser = jest.fn()
jest.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: () => mockUseUser(),
}))
jest.mock("@lib/formatters", () => ({ todayIso: () => "2026-11-03" }))

function Probe(): React.ReactElement {
  const r = useRegistration()
  return (
    <div>
      <span>checking:{String(r.isChecking)}</span>
      <span>registered:{String(r.isRegistered)}</span>
      <span>new:{String(r.isNewlyRegistered)}</span>
      <span>onboarded:{String(r.isOnboardingComplete)}</span>
      <span>error:{r.error ?? "none"}</span>
      <button onClick={r.markOnboardingComplete}>complete</button>
    </div>
  )
}

const renderProvider = (): ReturnType<typeof render> =>
  render(
    <RegistrationProvider>
      <Probe />
    </RegistrationProvider>,
  )

describe("RegistrationProvider", () => {
  const fetchMock = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    global.fetch = fetchMock as unknown as typeof fetch
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("stays checking while the user is loading", () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: true })
    renderProvider()
    expect(screen.getByText("checking:true")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("stops checking without registering when no user", async () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByText("checking:false")).toBeInTheDocument(),
    )
    expect(screen.getByText("registered:false")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses the cached registration and skips the network", async () => {
    localStorage.setItem(
      "bc_registered:u1",
      JSON.stringify({ since: "2020-01-01", checkedAt: Date.now() }),
    )
    localStorage.setItem("bc_onboarding_complete", "true")
    mockUseUser.mockReturnValue({ user: { sub: "u1" }, isLoading: false })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByText("registered:true")).toBeInTheDocument(),
    )
    expect(screen.getByText("onboarded:true")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ignores an expired cache entry and re-registers", async () => {
    localStorage.setItem(
      "bc_registered:u1",
      JSON.stringify({ checkedAt: Date.now() - 400 * 24 * 3600 * 1000 }),
    )
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { since: "2020-01-01" } }),
    })
    mockUseUser.mockReturnValue({ user: { sub: "u1" }, isLoading: false })
    renderProvider()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByText("checking:false")).toBeInTheDocument(),
    )
  })

  it("ignores a corrupt cache entry", async () => {
    localStorage.setItem("bc_registered:u1", "{not json")
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    })
    mockUseUser.mockReturnValue({ user: { sub: "u1" }, isLoading: false })
    renderProvider()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })

  it("flags a user created today as newly registered and caches it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { since: "2026-11-03" } }),
    })
    mockUseUser.mockReturnValue({ user: { sub: "u2" }, isLoading: false })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByText("new:true")).toBeInTheDocument(),
    )
    expect(screen.getByText("onboarded:false")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/register",
      expect.objectContaining({ method: "POST" }),
    )
    expect(localStorage.getItem("bc_registered:u2")).toContain("2026-11-03")
  })

  it("does not flag an existing user as new", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { since: "2020-05-05" } }),
    })
    mockUseUser.mockReturnValue({ user: { sub: "u3" }, isLoading: false })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByText("checking:false")).toBeInTheDocument(),
    )
    expect(screen.getByText("new:false")).toBeInTheDocument()
    expect(screen.getByText("registered:true")).toBeInTheDocument()
  })

  it("surfaces an HTTP failure but still lets the app function", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve("down"),
    })
    mockUseUser.mockReturnValue({ user: { sub: "u4" }, isLoading: false })
    renderProvider()
    await waitFor(() =>
      expect(
        screen.getByText("error:Registration failed: 503"),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText("registered:true")).toBeInTheDocument()
  })

  it("surfaces a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    mockUseUser.mockReturnValue({ user: { sub: "u5" }, isLoading: false })
    renderProvider()
    await waitFor(() =>
      expect(
        screen.getByText("error:Failed to connect to server"),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText("checking:false")).toBeInTheDocument()
  })

  it("markOnboardingComplete persists and clears the newly registered flag", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { since: "2026-11-03" } }),
    })
    mockUseUser.mockReturnValue({ user: { sub: "u6" }, isLoading: false })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByText("new:true")).toBeInTheDocument(),
    )
    await act(async () => {
      await userEvent.click(screen.getByText("complete"))
    })
    expect(screen.getByText("new:false")).toBeInTheDocument()
    expect(screen.getByText("onboarded:true")).toBeInTheDocument()
    expect(localStorage.getItem("bc_onboarding_complete")).toBe("true")
  })
})
