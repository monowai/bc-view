import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { Portfolio } from "types/beancounter"
import ShareInviteDialog from "@components/features/portfolios/ShareInviteDialog"
import ResourceShareInviteDialog from "@components/features/shares/ResourceShareInviteDialog"
import { inviteAdviser, inviteResourceShare } from "@utils/api/client/shares"

jest.mock("@utils/api/client/shares", () => ({
  inviteAdviser: jest.fn(),
  inviteResourceShare: jest.fn(),
}))

const mockInviteAdviser = inviteAdviser as jest.Mock
const mockInviteResourceShare = inviteResourceShare as jest.Mock

const portfolios = [
  { id: "p1", code: "ALPHA", name: "Alpha Fund" },
  { id: "p2", code: "BETA", name: "Beta Fund" },
] as Portfolio[]

const enterEmail = (email: string): void => {
  fireEvent.change(
    screen.getByPlaceholderText("Enter adviser's email address"),
    { target: { value: email } },
  )
}

const send = (): void => {
  fireEvent.click(screen.getByText("Send Invite"))
}

describe("ShareInviteDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInviteAdviser.mockResolvedValue({ ok: true })
  })

  it("should render portfolio code and name under the portfolio labels", () => {
    render(
      <ShareInviteDialog
        portfolios={portfolios}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    expect(screen.getByText("Share Portfolios")).toBeInTheDocument()
    expect(screen.getByText("Select portfolios to share")).toBeInTheDocument()
    expect(screen.getByText("ALPHA")).toBeInTheDocument()
    expect(screen.getByText("Alpha Fund")).toBeInTheDocument()
  })

  it("should disable send until email and a portfolio are chosen", () => {
    render(
      <ShareInviteDialog
        portfolios={portfolios}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    const button = screen.getByText("Send Invite").closest("button")
    expect(button).toBeDisabled()
    enterEmail("adviser@example.com")
    expect(button).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/ALPHA/))
    expect(button).toBeEnabled()
    fireEvent.click(screen.getByLabelText(/ALPHA/))
    expect(button).toBeDisabled()
  })

  it("should send the trimmed email, pre-selected portfolio and access level", async () => {
    render(
      <ShareInviteDialog
        portfolios={portfolios}
        preSelectedPortfolioId="p2"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    enterEmail("  adviser@example.com ")
    fireEvent.click(screen.getByLabelText("Full Access"))
    send()
    await waitFor(() =>
      expect(mockInviteAdviser).toHaveBeenCalledWith({
        adviserEmail: "adviser@example.com",
        portfolioIds: ["p2"],
        accessLevel: "FULL",
      }),
    )
    expect(
      await screen.findByText("Invitation sent successfully"),
    ).toBeInTheDocument()
  })

  it("should show the server error when the invite fails", async () => {
    mockInviteAdviser.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Adviser not found" }),
    })
    render(
      <ShareInviteDialog
        portfolios={portfolios}
        preSelectedPortfolioId="p1"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    enterEmail("adviser@example.com")
    send()
    expect(await screen.findByText("Adviser not found")).toBeInTheDocument()
  })

  it("should fall back to the default error when the failure has no body", async () => {
    mockInviteAdviser.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("no body")),
    })
    render(
      <ShareInviteDialog
        portfolios={portfolios}
        preSelectedPortfolioId="p1"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    enterEmail("adviser@example.com")
    send()
    expect(
      await screen.findByText("Failed to send invitation"),
    ).toBeInTheDocument()
  })
})

describe("ResourceShareInviteDialog", () => {
  const plans = [
    { id: "r1", name: "Early Exit" },
    { id: "r2", name: "Late Exit" },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockInviteResourceShare.mockResolvedValue({ ok: true })
  })

  it("should label plans for INDEPENDENCE_PLAN resources", () => {
    render(
      <ResourceShareInviteDialog
        resourceType="INDEPENDENCE_PLAN"
        resources={plans}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    expect(screen.getByText("Share Plans")).toBeInTheDocument()
    expect(screen.getByText("Select Plans to share")).toBeInTheDocument()
    expect(screen.getByText("Early Exit")).toBeInTheDocument()
  })

  it("should label models for other resources", () => {
    render(
      <ResourceShareInviteDialog
        resourceType="REBALANCE_MODEL"
        resources={plans}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    expect(screen.getByText("Share Models")).toBeInTheDocument()
    expect(screen.getByText("Select Models to share")).toBeInTheDocument()
  })

  it("should send the resource type, selected ids and default access level", async () => {
    render(
      <ResourceShareInviteDialog
        resourceType="INDEPENDENCE_PLAN"
        resources={plans}
        preSelectedId="r1"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText("Late Exit"))
    enterEmail("adviser@example.com")
    send()
    await waitFor(() =>
      expect(mockInviteResourceShare).toHaveBeenCalledWith({
        resourceType: "INDEPENDENCE_PLAN",
        resourceIds: ["r1", "r2"],
        adviserEmail: "adviser@example.com",
        accessLevel: "VIEW",
      }),
    )
  })
})
