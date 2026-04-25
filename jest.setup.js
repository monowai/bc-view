// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom"
import React from "react"

module.exports = {
  setupFilesAfterEnv: ["./jest.setup.js"],
}

jest.mock("next/router", () => ({
  useRouter() {
    return {
      route: "/",
      pathname: "",
      query: "",
      asPath: "",
      push: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
      beforePopState: jest.fn(() => null),
      prefetch: jest.fn(() => null),
    }
  },
}))

// Mock next/link as a plain anchor — keeps tests independent of the Next.js
// router prefetching behavior.
jest.mock("next/link", () => {
  return function Link({ children, href, ...rest }) {
    return React.createElement("a", { href, ...rest }, children)
  }
})

// react-markdown / remark-gfm are ESM-only packages that fail to parse in Jest.
// Components like NewsSentimentPopup pull them in transitively.
jest.mock("react-markdown", () => {
  return function MockMarkdown({ children }) {
    return React.createElement("div", { "data-testid": "markdown" }, children)
  }
})
jest.mock("remark-gfm", () => () => {})

// Mock Auth0 client modules (v4)
jest.mock("@auth0/nextjs-auth0/client", () => {
  const mockUser = {
    sub: "auth0|test-user-id",
    nickname: "testuser",
    name: "Test User",
    picture: "https://example.com/avatar.jpg",
    email: "test@example.com",
    email_verified: true,
  }

  return {
    useUser: jest.fn(() => ({
      user: mockUser,
      error: null,
      isLoading: false,
    })),
    withPageAuthRequired: (Component) => {
      return (props) =>
        React.createElement(Component, { ...props, user: mockUser })
    },
    Auth0Provider: ({ children }) => children,
  }
})

// Mock Auth0 types module (v4)
jest.mock("@auth0/nextjs-auth0/types", () => ({}))

// Mock fetch globally for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: [] }),
  }),
)
