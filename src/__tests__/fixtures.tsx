import { UserProfile, UserProvider } from "@auth0/nextjs-auth0";
import { ConfigContext } from "@auth0/nextjs-auth0/dist/frontend/use-config";
import { ReactNode } from "react";

export const mockUser = {
  email: "foo@example.com",
  email_verified: true,
  name: "foo",
  nickname: "foo",
  picture: "foo.jpg",
  sub: "1",
  updated_at: null,
};
// https://github.com/auth0-samples/auth0-nextjs-samples/blob/main/Sample-01/tests/fixtures.jsx
export const withUserProvider = (user: UserProfile = {}) => {
  return (
    props: JSX.IntrinsicAttributes & {
      user?: UserProfile | undefined;
      profileUrl?: string | undefined;
      fetcher?: ((url: string) => Promise<UserProfile | undefined>) | undefined;
    } & ConfigContext & { children?: ReactNode }
  ) => <UserProvider {...props} user={user} profileUrl="profile.url" />;
};
