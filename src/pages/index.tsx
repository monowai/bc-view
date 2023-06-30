import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import React from "react";
import { useTranslation } from "next-i18next";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { rootLoader } from "@core/common/PageLoader";
import useSwr from "swr";
import { simpleFetcher } from "@core/api/fetchHelper";
const key = "/api/register";
export default withPageAuthRequired(function Home(): React.ReactElement {
  const { user, error, isLoading } = useUser();
  const { t } = useTranslation("common");

  const registration = useSwr(key, simpleFetcher(key));
  if (isLoading || registration.isLoading) return rootLoader(t("loading"));
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
  return <Link href={"/api/auth/login"}>{t("user.login")}</Link>;
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
