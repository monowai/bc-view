import React from "react"
import type { AppProps } from "next/app"
import { appWithTranslation } from "next-i18next"
import Header from "@components/layout/Header"
import { UserProvider } from "@auth0/nextjs-auth0/client"
//import "@styles/bc.sass"
import "@styles/globals.css"
import "@fortawesome/fontawesome-free/css/all.min.css"
import GitInfo from "@components/ui/GitInfo"
import { useRouter } from "next/router"
import { useAutoRegister } from "@hooks/useAutoRegister"

// Inner component that handles auto-registration (must be inside UserProvider)
interface AppContentProps {
  Component: AppProps["Component"]
  pageProps: AppProps["pageProps"]
  alwaysVisible: boolean
}

const AppContent: React.FC<AppContentProps> = ({
  Component,
  pageProps,
  alwaysVisible,
}) => {
  useAutoRegister()

  return (
    <>
      <div className="pt-0 p-3 sm:p-4 md:p-6 lg:p-8 bg-gray-100">
        <Header />
        <Component {...pageProps} />
      </div>
      <GitInfo alwaysVisible={alwaysVisible} />
    </>
  )
}

const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  const router = useRouter()
  const alwaysVisible =
    router.pathname === "/" || router.pathname === "/portfolios"

  return (
    <UserProvider>
      <AppContent
        Component={Component}
        pageProps={pageProps}
        alwaysVisible={alwaysVisible}
      />
    </UserProvider>
  )
}

export default appWithTranslation(App)
