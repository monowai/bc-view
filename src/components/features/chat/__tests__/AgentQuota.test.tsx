import React from "react"
import { render, screen } from "@testing-library/react"
import {
  AgentQuotaLine,
  AgentQuotaNotice,
} from "@components/features/chat/AgentQuota"
import { useAgentQuota } from "@hooks/useAgentQuota"
import { makeAgentQuota } from "@test-fixtures/beancounter"
import { AgentQuotaStatus } from "types/agent"

const mockUseAgentQuota = useAgentQuota as jest.MockedFunction<
  typeof useAgentQuota
>

function withQuota(quota: AgentQuotaStatus | undefined): void {
  mockUseAgentQuota.mockReturnValue({
    quota,
    isLoading: false,
    refresh: jest.fn(),
  })
}

describe("AgentQuotaLine", () => {
  it("shows a metered user what is left this week", () => {
    withQuota(makeAgentQuota({ limit: 10, used: 3, remaining: 7 }))

    render(<AgentQuotaLine />)

    expect(
      screen.getByText("7 of 10 AI questions left this week"),
    ).toBeInTheDocument()
  })

  it("shows nothing to an unlimited user", () => {
    withQuota(makeAgentQuota({ unlimited: true }))

    const { container } = render(<AgentQuotaLine />)

    expect(container).toBeEmptyDOMElement()
  })

  it("shows nothing before the quota has loaded", () => {
    withQuota(undefined)

    const { container } = render(<AgentQuotaLine />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe("AgentQuotaNotice", () => {
  it("says the week's questions are used, when one frees up, and who to ask for more", () => {
    withQuota(
      makeAgentQuota({
        limit: 10,
        used: 10,
        remaining: 0,
        resetAt: "2026-10-29T12:00:00Z",
        contact: "help@example.com",
      }),
    )

    render(<AgentQuotaNotice />)

    expect(
      screen.getByText(/used this week's AI questions/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/The next one frees up/)).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "help@example.com" })
    expect(link).toHaveAttribute("href", "mailto:help@example.com")
  })

  it("still explains itself before the quota has loaded", () => {
    withQuota(undefined)

    render(<AgentQuotaNotice />)

    expect(
      screen.getByText(/used this week's AI questions/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
