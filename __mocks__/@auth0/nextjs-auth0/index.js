// Mock Auth0 Next.js SDK v4 for Jest tests (root import = client)
/* eslint-disable @typescript-eslint/explicit-function-return-type */

const mockUser = {
  sub: "auth0|test-user-id",
  nickname: "testuser",
  name: "Test User",
  picture: "https://example.com/avatar.jpg",
  email: "test@example.com",
  email_verified: true,
}

// Mock hooks
export const useUser = jest.fn(() => ({
  user: mockUser,
  error: null,
  isLoading: false,
}))

// Mock HOCs - for testing, just return the component as-is
export const withPageAuthRequired = (Component) => {
  return Component
}

// Mock provider (v4: Auth0Provider replaces UserProvider)
export const Auth0Provider = jest.fn(({ children }) => children)

// Mock getAccessToken (client-side)
export const getAccessToken = jest.fn(() =>
  Promise.resolve({ token: "mock-access-token" }),
)

// Default export for CommonJS compatibility
module.exports = {
  useUser,
  withPageAuthRequired,
  Auth0Provider,
  getAccessToken,
}
