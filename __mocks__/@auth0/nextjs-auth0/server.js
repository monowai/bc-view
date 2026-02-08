// Mock Auth0 Next.js SDK v4 server module for Jest tests
/* eslint-disable @typescript-eslint/explicit-function-return-type */

const Auth0Client = jest.fn().mockImplementation(() => ({
  getSession: jest.fn().mockResolvedValue({ user: { sub: "test-user" } }),
  getAccessToken: jest.fn().mockResolvedValue({ token: "mock-access-token" }),
  middleware: jest.fn().mockResolvedValue(new Response()),
}))

module.exports = { Auth0Client }
