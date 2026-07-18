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

// Portfolio count drives zen mode (single portfolio hides portfolio-list nav).
let mockPortfolios: Array<{ id: string }> = []
jest.mock("@hooks/usePortfolios", () => ({
  usePortfolios: () => ({ portfolios: mockPortfolios }),
}))

describe("HeaderBrand", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPortfolios = [{ id: "pf-1" }, { id: "pf-2" }] // master mode by default
  })

  it("shows an in-development badge linking to the repo, even when unauthenticated", () => {
    mockUseUser.mockReturnValueOnce({
      user: undefined,
      error: undefined,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)

    render(<HeaderBrand />)
    const badge = screen.getByRole("link", { name: /development/i })
    expect(badge).toHaveAttribute("href", "https://github.com/monowai/bc-view")
    expect(badge).toHaveTextContent(/beta/i)
  })

  it("renders nav dropdowns for authenticated user", () => {
    render(<HeaderBrand />)
    expect(screen.getByRole("button", { name: /^Wealth/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Invest/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Plan/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Tools/i })).toBeInTheDocument()
  })

  it("shows the Portfolios link in master mode (multiple portfolios)", () => {
    render(<HeaderBrand />)
    fireEvent.click(screen.getByRole("button", { name: /^Wealth/i }))
    expect(
      screen.getByRole("link", { name: /Portfolios/i }),
    ).toBeInTheDocument()
  })

  it("hides the Portfolios link in zen mode (single portfolio)", () => {
    mockPortfolios = [{ id: "pf-1" }]
    render(<HeaderBrand />)
    fireEvent.click(screen.getByRole("button", { name: /^Wealth/i }))
    // Net Worth still there; the portfolio list is gone.
    expect(screen.getByRole("link", { name: /Net Worth/i })).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /Portfolios/i }),
    ).not.toBeInTheDocument()
  })

  it("Tools dropdown has a single Brokers entry (Open Brokerage lives on /brokers)", () => {
    render(<HeaderBrand />)
    fireEvent.click(screen.getByRole("button", { name: /^Tools/i }))
    const brokers = screen.getByRole("link", { name: /Brokers/i })
    expect(brokers).toHaveAttribute("href", "/brokers")
    expect(
      screen.queryByRole("link", { name: /Open Brokerage/i }),
    ).not.toBeInTheDocument()
  })

  it("Tools dropdown includes Cost Stack link", () => {
    render(<HeaderBrand />)
    fireEvent.click(screen.getByRole("button", { name: /^Tools/i }))
    const link = screen.getByRole("link", { name: /Cost Stack/i })
    expect(link).toHaveAttribute("href", "/tools/cost-stack")
  })

  it("locks background scroll while the mobile menu is open", () => {
    window.scrollTo = jest.fn()
    render(<HeaderBrand />)
    const toggle = screen.getByRole("button", { name: /Navigation menu/i })
    expect(document.body.style.position).toBe("")
    fireEvent.click(toggle)
    expect(document.body.style.position).toBe("fixed")
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.click(toggle)
    expect(document.body.style.position).toBe("")
    expect(document.body.style.overflow).toBe("")
  })

  it("opens the mobile drawer and closes it via the backdrop", () => {
    window.scrollTo = jest.fn()
    render(<HeaderBrand />)
    expect(
      screen.queryByRole("dialog", { name: "Navigation" }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Navigation menu/i }))
    expect(
      screen.getByRole("dialog", { name: "Navigation" }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("mobile-nav-backdrop"))
    expect(
      screen.queryByRole("dialog", { name: "Navigation" }),
    ).not.toBeInTheDocument()
  })

  it("closes the mobile drawer on Escape", () => {
    window.scrollTo = jest.fn()
    render(<HeaderBrand />)
    fireEvent.click(screen.getByRole("button", { name: /Navigation menu/i }))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(
      screen.queryByRole("dialog", { name: "Navigation" }),
    ).not.toBeInTheDocument()
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
