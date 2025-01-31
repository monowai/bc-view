import React from "react"
import type { AppProps } from "next/app"
import { appWithTranslation } from "next-i18next"
import Header from "@pages/header/Header"
import { UserProvider } from "@auth0/nextjs-auth0/client"
//import "@styles/bc.sass"
import "@styles/globals.css"
import "@fortawesome/fontawesome-free/css/all.min.css"
import GitInfo from "@components/GitInfo"
import { useRouter } from "next/router"

const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  const router = useRouter()
  const alwaysVisible =
    router.pathname === "/" || router.pathname === "/portfolios"

  return (
    <UserProvider>
      <div className="pt-0 p-3 sm:p-4 md:p-6 lg:p-8 bg-gray-100">
        <Header />
        <Component {...pageProps} />
      </div>
      <GitInfo alwaysVisible={alwaysVisible} />
    </UserProvider>
  )
}

export default appWithTranslation(App)
