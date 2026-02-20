import React from "react"
import type { AppProps } from "next/app"
import { appWithTranslation } from "next-i18next"
import Header from "@components/layout/Header"
import { Auth0Provider } from "@auth0/nextjs-auth0/client"
//import "@styles/bc.sass"
import "@styles/globals.css"
import "@fortawesome/fontawesome-free/css/all.min.css"
import GitInfo from "@components/ui/GitInfo"
import { RegistrationProvider } from "@contexts/RegistrationContext"
import { UserPreferencesProvider } from "@contexts/UserPreferencesContext"
import { PrivacyModeProvider } from "@hooks/usePrivacyMode"
import { DM_Sans, JetBrains_Mono } from "next/font/google"

// Load fonts with next/font for optimal performance
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

// Inner component that renders the app content
interface AppContentProps {
  Component: AppProps["Component"]
  pageProps: AppProps["pageProps"]
}

const AppContent: React.FC<AppContentProps> = ({ Component, pageProps }) => {
  return (
    <div className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans`}>
      <div className="bg-gray-100 min-h-screen">
        <Header />
        <div className="px-2 pt-2 pb-2 sm:px-3 sm:pt-3 sm:pb-3 md:px-4 md:pb-4">
          <Component {...pageProps} />
        </div>
      </div>
      <GitInfo />
    </div>
  )
}

const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <Auth0Provider>
      <RegistrationProvider>
        <UserPreferencesProvider>
          <PrivacyModeProvider>
            <AppContent Component={Component} pageProps={pageProps} />
          </PrivacyModeProvider>
        </UserPreferencesProvider>
      </RegistrationProvider>
    </Auth0Provider>
  )
}

export default appWithTranslation(App)
