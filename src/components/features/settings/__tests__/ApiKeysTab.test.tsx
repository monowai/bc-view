import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import ApiKeysTab from "../ApiKeysTab"
import { useApiKeys } from "@hooks/useApiKeys"
import { makeApiKey } from "@test-fixtures/beancounter"

jest.mock("@hooks/useApiKeys")

const mockUseApiKeys = useApiKeys as jest.MockedFunction<typeof useApiKeys>

const RAW_KEY = "bc_test1234567890abcdef1234567890"

function setupHook(overrides: Partial<ReturnType<typeof useApiKeys>> = {}): {
  createKey: jest.Mock
  revokeKey: jest.Mock
  mutate: jest.Mock
} {
  const createKey = jest.fn()
  const revokeKey = jest.fn().mockResolvedValue(undefined)
  const mutate = jest.fn()
  mockUseApiKeys.mockReturnValue({
    keys: [],
    error: undefined,
    isLoading: false,
    mutate,
    createKey,
    revokeKey,
    ...overrides,
  })
  return { createKey, revokeKey, mutate }
}

describe("ApiKeysTab", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    })
  })

  it("renders key rows with name, prefix ellipsis and Active badge", () => {
    setupHook({
      keys: [makeApiKey({ id: "k1", name: "My Agent", prefix: "bc_a1b2c" })],
    })
    render(<ApiKeysTab />)

    expect(screen.getByText("My Agent")).toBeInTheDocument()
    expect(screen.getByText("bc_a1b2c…")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument()
  })

  it("shows Revoked badge and no revoke button for a revoked key", () => {
    setupHook({
      keys: [
        makeApiKey({
          id: "k2",
          name: "Old Agent",
          revokedAt: "2026-01-02T00:00:00Z",
        }),
      ],
    })
    render(<ApiKeysTab />)

    expect(screen.getByText("Revoked")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /revoke/i }),
    ).not.toBeInTheDocument()
  })

  it("renders 'Never' when lastUsedAt is null", () => {
    setupHook({
      keys: [makeApiKey({ id: "k3", name: "Unused Agent", lastUsedAt: null })],
    })
    render(<ApiKeysTab />)

    expect(screen.getByText("Never")).toBeInTheDocument()
  })

  it("focuses the name field when the create dialog opens", () => {
    setupHook()

    render(<ApiKeysTab />)

    fireEvent.click(screen.getByRole("button", { name: /create api key/i }))

    expect(screen.getByLabelText(/name/i)).toHaveFocus()
  })

  it("creates a key and shows the raw key exactly once with the shown-only-once warning", async () => {
    const created = {
      data: makeApiKey({ id: "k4", name: "New Agent" }),
      apiKey: RAW_KEY,
    }
    const { createKey } = setupHook()
    createKey.mockResolvedValue(created)

    render(<ApiKeysTab />)

    fireEvent.click(screen.getByRole("button", { name: /create api key/i }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "New Agent" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(createKey).toHaveBeenCalledWith({
        name: "New Agent",
        scopes: [],
      })
    })

    expect(await screen.findAllByText(RAW_KEY)).toHaveLength(1)
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument()
  })

  it("sends the expiry as end-of-day in the user's own timezone", async () => {
    const created = {
      data: makeApiKey({ id: "k4b", name: "Expiring Agent" }),
      apiKey: RAW_KEY,
    }
    const { createKey } = setupHook()
    createKey.mockResolvedValue(created)

    render(<ApiKeysTab />)

    fireEvent.click(screen.getByRole("button", { name: /create api key/i }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Expiring Agent" },
    })
    fireEvent.change(screen.getByLabelText(/expires/i), {
      target: { value: "2030-01-15" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(createKey).toHaveBeenCalledWith({
        name: "Expiring Agent",
        scopes: [],
        expiresAt: new Date(2030, 0, 15, 23, 59, 59).toISOString(),
      })
    })
  })

  it("copies the raw key to the clipboard", async () => {
    const created = {
      data: makeApiKey({ id: "k5", name: "New Agent" }),
      apiKey: RAW_KEY,
    }
    const { createKey } = setupHook()
    createKey.mockResolvedValue(created)

    render(<ApiKeysTab />)

    fireEvent.click(screen.getByRole("button", { name: /create api key/i }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "New Agent" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }))

    await screen.findByText(RAW_KEY)

    fireEvent.click(screen.getByRole("button", { name: /copy/i }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(RAW_KEY)
    })
  })

  it("warns instead of pretending success when the clipboard write fails", async () => {
    const created = {
      data: makeApiKey({ id: "k5b", name: "New Agent" }),
      apiKey: RAW_KEY,
    }
    const { createKey } = setupHook()
    createKey.mockResolvedValue(created)
    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error("denied"),
    )

    render(<ApiKeysTab />)

    fireEvent.click(screen.getByRole("button", { name: /create api key/i }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "New Agent" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }))

    await screen.findByText(RAW_KEY)

    fireEvent.click(screen.getByRole("button", { name: /copy/i }))

    expect(await screen.findByText(/copy failed/i)).toBeInTheDocument()
    expect(screen.queryByText("Copied!")).not.toBeInTheDocument()
  })

  it("keeps the confirm dialog open with a loading label while the revoke is in flight", async () => {
    let resolveRevoke: () => void = () => undefined
    const { revokeKey } = setupHook({
      keys: [makeApiKey({ id: "k6b", name: "Slow Revoke" })],
    })
    revokeKey.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRevoke = resolve
        }),
    )

    render(<ApiKeysTab />)

    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }))
    fireEvent.click(screen.getByRole("button", { name: /revoke key/i }))

    // Dialog stays open while the revoke runs; its confirm button (and the
    // table row behind it) shows the loading label, disabled.
    expect(screen.getByText(/revoking is immediate/i)).toBeInTheDocument()
    const revokingButtons = await screen.findAllByRole("button", {
      name: /revoking/i,
    })
    revokingButtons.forEach((button) => expect(button).toBeDisabled())

    resolveRevoke()

    await waitFor(() => {
      expect(
        screen.queryByText(/revoking is immediate/i),
      ).not.toBeInTheDocument()
    })
  })

  it("revokes a key after confirming in the ConfirmDialog", async () => {
    const { revokeKey } = setupHook({
      keys: [makeApiKey({ id: "k6", name: "Agent To Revoke" })],
    })

    render(<ApiKeysTab />)

    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }))

    expect(screen.getByText(/revoking is immediate/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /revoke key/i }))

    await waitFor(() => {
      expect(revokeKey).toHaveBeenCalledWith("k6")
    })
  })

  it("does not call createKey when name is blank", () => {
    const { createKey } = setupHook()

    render(<ApiKeysTab />)

    fireEvent.click(screen.getByRole("button", { name: /create api key/i }))
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }))

    expect(createKey).not.toHaveBeenCalled()
  })
})
