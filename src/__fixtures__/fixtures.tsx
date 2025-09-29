import { UserProfile, UserProvider } from "@auth0/nextjs-auth0/client"
import React, { ReactNode } from "react"
import { PortfolioResponses, RegistrationResponse } from "types/beancounter"

export const mockUserProfile: UserProfile = {
  email: "foo@example.com",
  email_verified: true,
  name: "foo",
  nickname: "foo",
  picture: "foo.jpg",
  sub: "1",
  updated_at: null,
}
export const registrationSuccess: RegistrationResponse = {
  data: {
    id: "ownerId",
    email: "mike@bc.com",
    active: true,
    since: "2020-03-03",
  },
}

export const portfolioResult: PortfolioResponses = {
  data: [
    {
      id: "P123",
      code: "P123",
      name: "Portfolio 1",
      currency: {
        code: "EUR",
        name: "Euro",
        symbol: "€",
      },
      base: {
        code: "USD",
        name: "Dollar",
        symbol: "$",
      },
      owner: {
        id: "ownerId",
        email: "mike@bc.com",
        active: true,
        since: "2020-03-03",
      },
      marketValue: 0,
      irr: 0,
    },
  ],
}
export const withUserProvider = (
  user: UserProfile = mockUserProfile,
): React.ComponentType<{ children: ReactNode }> => {
  const TestUserProvider = ({
    children,
  }: {
    children: ReactNode
  }): React.ReactElement => <UserProvider>{children}</UserProvider>
  TestUserProvider.displayName = `TestUserProvider(${user.name})`
  return TestUserProvider
}
