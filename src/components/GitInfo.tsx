import React, { useEffect, useState } from "react"

interface GitInfoData {
  branch: string
  commit: string
  build: string
}

interface GitInfoProps {
  alwaysVisible?: boolean
}

const GitInfo: React.FC<GitInfoProps> = ({ alwaysVisible = false }) => {
  const [gitInfo, setGitInfo] = useState<GitInfoData | null>(null)
  const [visible, setVisible] = useState(alwaysVisible)

  useEffect(() => {
    const fetchGitInfo = async (): Promise<void> => {
      const response = await fetch("/api/git-info")
      if (!response.ok) {
        throw new Error("Network response was not ok")
      }
      const data: GitInfoData = await response.json()
      setGitInfo(data)
    }

    fetchGitInfo().then()
  }, [])

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
    return <div>Loading...</div>
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
