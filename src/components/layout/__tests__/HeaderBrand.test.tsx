import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import HeaderBrand from "../HeaderBrand"
import { useUser } from "@auth0/nextjs-auth0/client"

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>

jest.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/",
    events: { on: jest.fn(), off: jest.fn() },
    push: jest.fn(),
  }),
}))

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({
    ai: false,
    preview: false,
    admin: false,
    isLoading: false,
  }),
}))

describe("HeaderBrand", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nav dropdowns for authenticated user", () => {
    render(<HeaderBrand />)
    expect(screen.getByRole("button", { name: /^Wealth/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Invest/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Plan/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Tools/i })).toBeInTheDocument()
  })

  it("Tools dropdown includes Cost Stack link", () => {
    render(<HeaderBrand />)
    fireEvent.click(screen.getByRole("button", { name: /^Tools/i }))
    const link = screen.getByRole("link", { name: /Cost Stack/i })
    expect(link).toHaveAttribute("href", "/tools/cost-stack")
  })

  it("hides nav dropdowns when unauthenticated", () => {
    mockUseUser.mockReturnValueOnce({
      user: undefined,
      error: undefined,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)

    render(<HeaderBrand />)
    expect(
      screen.queryByRole("button", { name: /^Wealth/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Invest/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Plan/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Tools/i }),
    ).not.toBeInTheDocument()
    // Mobile hamburger also hidden
    expect(
      screen.queryByRole("button", { name: /Navigation menu/i }),
    ).not.toBeInTheDocument()
  })
})
