import React from "react"
import { useRouter } from "next/router"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

function HeaderBrand(): React.ReactElement {
  const router = useRouter()
  return (
    <div className="flex items-center">
      <a
        className="text-xl font-bold cursor-pointer"
        onClick={() => {
          router.push("/portfolios")
        }}
      >
        Holds<i>worth</i>
        {/*<img src={Logo} />*/}
      </a>
      <div className="ml-4 cursor-pointer">
        <span className="block w-6 h-1 bg-gray-800 mb-2"></span>
        <span className="block w-6 h-1 bg-gray-800 mb-1"></span>
        <span className="block w-6 h-1 bg-gray-800"></span>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})

export default HeaderBrand
