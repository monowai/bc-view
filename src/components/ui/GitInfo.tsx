import React, { useEffect, useState } from "react"
import { useBuildVersion } from "@hooks/useBuildVersion"

interface GitInfoProps {
  alwaysVisible?: boolean
}

const GitInfo: React.FC<GitInfoProps> = ({ alwaysVisible = false }) => {
  const { info: gitInfo } = useBuildVersion()
  const [visible, setVisible] = useState(alwaysVisible)

  useEffect(() => {
    let timeout: NodeJS.Timeout

    if (!alwaysVisible) {
      const handleMouseMove = (event: MouseEvent): void => {
        if (event.clientY >= window.innerHeight - 10) {
          timeout = setTimeout(() => setVisible(true), 2000)
        } else {
          clearTimeout(timeout)
          setVisible(false)
        }
      }

      window.addEventListener("mousemove", handleMouseMove)

      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        clearTimeout(timeout)
      }
    }

    return (): void => {
      clearTimeout(timeout)
    }
  }, [alwaysVisible])

  if (!gitInfo) {
    return <div />
  }

  return (
    <footer
      className={`fixed bottom-0 w-full bg-gray-200 text-xs p-2 flex justify-between transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <span>Branch: {gitInfo.branch}</span>
      <span>Commit: {gitInfo.commit}</span>
      <span>Build: {gitInfo.build}</span>
    </footer>
  )
}

export default GitInfo
