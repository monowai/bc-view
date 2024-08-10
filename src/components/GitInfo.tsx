import React, { useEffect, useState } from "react";

interface GitInfoData {
  branch: string;
  commit: string;
  remote: string;
  build: string;
}

interface GitInfoProps {
  alwaysVisible?: boolean;
}

const GitInfo: React.FC<GitInfoProps> = ({ alwaysVisible = false }) => {
  const [gitInfo, setGitInfo] = useState<GitInfoData | null>(null);
  const [visible, setVisible] = useState(alwaysVisible);

  useEffect(() => {
    const fetchGitInfo = async (): Promise<void> => {
      const response = await fetch("/api/git-info");
      const data: GitInfoData = await response.json();
      setGitInfo(data);
    };

    fetchGitInfo().then();
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (!alwaysVisible) {
      const handleMouseMove = (event: MouseEvent): void => {
        if (event.clientY >= window.innerHeight - 10) {
          timeout = setTimeout(() => setVisible(true), 2000);
        } else {
          clearTimeout(timeout);
          setVisible(false);
        }
      };

      window.addEventListener("mousemove", handleMouseMove);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        clearTimeout(timeout);
      };
    }

    return (): void => {
      clearTimeout(timeout);
    };
  }, [alwaysVisible]);

  if (!gitInfo) {
    return <div>Loading...</div>;
  }

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        backgroundColor: "#f1f1f1",
        fontSize: "12px",
        padding: "10px",
        display: "flex",
        justifyContent: "space-between",
        transition: "transform 0.3s",
        transform: visible ? "translateY(0)" : "translateY(100%)",
      }}
    >
      <span>Branch: {gitInfo.branch}</span>
      <span>Commit: {gitInfo.commit}</span>
      <span>Build: {gitInfo.build}</span>
    </footer>
  );
};

export default GitInfo;
