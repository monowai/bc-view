import React, { useState } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useTranslation } from "next-i18next"
import { getAvatar } from "@pages/profile"

export default function HeaderUserControls(): React.ReactElement {
  const { user, error, isLoading } = useUser()
  const { t } = useTranslation("common")
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (isLoading) return <div>{t("loading")}</div>
  if (error) return <div>{error.message}</div>
  if (!user)
    return (
      <div>
        <Link href="/api/auth/login">{t("user.login")}</Link>
      </div>
    )

  return (
    <div className="relative">
      <div className="flex items-center">
        <div
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="cursor-pointer"
        >
          {getAvatar(user, 30)}
        </div>
        <div className="ml-2">{user.nickname}</div>
      </div>
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-black border rounded shadow-lg">
          <Link
            href="/api/auth/logout"
            className="block px-4 py-2 text-black hover:bg-black-200"
          >
            {t("user.logout")}
          </Link>
        </div>
      )}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
