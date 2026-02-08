// Mock Auth0 Next.js SDK v4 client module for Jest tests
/* eslint-disable @typescript-eslint/explicit-function-return-type */

const React = require("react")

const mockUser = {
  sub: "auth0|test-user-id",
  nickname: "testuser",
  name: "Test User",
  picture: "https://example.com/avatar.jpg",
  email: "test@example.com",
  email_verified: true,
}

const useUser = jest.fn(() => ({
  user: mockUser,
  error: null,
  isLoading: false,
}))

const withPageAuthRequired = (Component) => {
  return (props) => React.createElement(Component, { ...props, user: mockUser })
}

const Auth0Provider = ({ children }) => children

const getAccessToken = jest.fn(() =>
  Promise.resolve({ token: "mock-access-token" }),
)

module.exports = {
  useUser,
  withPageAuthRequired,
  Auth0Provider,
  getAccessToken,
}
