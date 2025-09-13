// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom"
import React from "react"

module.exports = {
  setupFilesAfterEnv: ["./jest.setup.js"],
}

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    ready: true,
    t: (key) => key,
    i18n: {
      changeLanguage: jest.fn(),
    },
  }),
}))

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

// Mock Auth0 client modules
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
    UserProvider: ({ children }) => children,
  }
})

// Mock fetch globally for API calls
global.fetch = jest.fn()
