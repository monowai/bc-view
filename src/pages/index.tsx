import { useUser } from "@auth0/nextjs-auth0";
import Link from "next/link";
import React from "react";
import { useTranslation } from "next-i18next";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default function Home(): any {
  const { user, error, isLoading } = useUser();
  const { t, ready } = useTranslation("common");

  if (isLoading || !ready) return <div />;
  if (error) return <div>{error.message}</div>;

  if (user) {
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

  return <a href="/api/auth/login">{t("user.login")}</a>;
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
