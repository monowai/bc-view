import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import React from "react"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { rootLoader } from "@components/PageLoader"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import GitInfo from "@components/GitInfo"

const key = "/api/register"
export default withPageAuthRequired(function Home(): React.ReactElement {
  const { user, error, isLoading } = useUser()
  const { t } = useTranslation("common")

  const registration = useSwr(key, simpleFetcher(key))
  if (isLoading || registration.isLoading) return rootLoader(t("loading"))
  if (error) return <div>{error.message}</div>
  if (user) {
    // noinspection HtmlUnknownTarget
    return (
      <div>
        {t("home.welcome")}
        <div>
          <Link href="/portfolios" legacyBehavior>
            {t("home.portfolios")}
          </Link>
        </div>
        <div>
          <Link href="/api/auth/logout" legacyBehavior>
            {t("user.logout")}
          </Link>
        </div>
        <GitInfo />
      </div>
    )
  }
  return (
    <Link href={"/api/auth/login"} legacyBehavior>
      {t("user.login")}
    </Link>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
