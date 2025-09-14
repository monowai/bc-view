// Mock Auth0 Next.js SDK for Jest tests
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
// The UserProvider wrapper in tests will handle providing the user
export const withPageAuthRequired = (Component) => {
  return Component
}

// Mock provider
export const Auth0Provider = jest.fn(({ children }) => children)

// Mock getAccessToken for server-side usage
export const getAccessToken = jest.fn(() =>
  Promise.resolve({ accessToken: "mock-access-token" }),
)

// Mock User type
export const User = {}

// Default export for CommonJS compatibility
module.exports = {
  useUser,
  withPageAuthRequired,
  Auth0Provider,
  getAccessToken,
  User,
}
