import { UserProfile, UserProvider } from "@auth0/nextjs-auth0/client";
import { ReactNode } from "react";
import { ConfigContext } from "@auth0/nextjs-auth0/dist/client/use-config";

export const mockUser = {
  email: "foo@example.com",
  email_verified: true,
  name: "foo",
  nickname: "foo",
  picture: "foo.jpg",
  sub: "1",
  updated_at: null,
};
export const withUserProvider = (user: UserProfile = {}) => {
  return (
    props: JSX.IntrinsicAttributes & {
      user?: UserProfile | undefined;
      profileUrl?: string | undefined;
      fetcher?: ((url: string) => Promise<UserProfile | undefined>) | undefined;
    } & ConfigContext & { children?: ReactNode }
  ) => <UserProvider {...props} user={user} profileUrl="profile.url" />;
};
