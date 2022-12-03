import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import React from "react";
import { useTranslation } from "next-i18next";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default withPageAuthRequired(function Home(): React.ReactElement {
  const { user, error, isLoading } = useUser();
  const { t, ready } = useTranslation("common");

  if (isLoading || !ready) return <div />;
  if (error) return <div>{error.message}</div>;

  if (user) {
    // noinspection HtmlUnknownTarget
    return (
      <div>
        {t("home.welcome")}
        <div>
          <Link href="/portfolios">{t("home.portfolios")}</Link>
        </div>
        <div>
          <Link href="/api/auth/logout">{t("user.logout")}</Link>
        </div>
      </div>
    );
  }
  // noinspection HtmlUnknownTarget
  return <Link href="/api/auth/login">{t("user.login")}</Link>;
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
