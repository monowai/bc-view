import React from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function HeaderUserControls(): React.ReactElement {
  const { user, error, isLoading } = useUser();
  const { t, ready } = useTranslation("common");
  if (isLoading || !ready) return <div>{t("loading")}</div>;
  if (error) return <div>{error.message}</div>;
  if (!user)
    // noinspection HtmlUnknownTarget
    return (
      <div>
        <Link href="/api/auth/login">{t("user.login")}</Link>
      </div>
    );

  // noinspection HtmlUnknownTarget
  const loggedIn = (
    <div className="navbar-dropdown">
      <div>
        <Link href="/profile">{t("user.profile")}</Link>
      </div>
      <div>
        <Link href="/api/auth/logout">{t("user.logout")}</Link>
      </div>
    </div>
  );

  return (
    <div className="navbar-end">
      <div className="navbar-item has-dropdown is-hoverable">
        <div className="navbar-link">
          {loggedIn}
          {user.email}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
