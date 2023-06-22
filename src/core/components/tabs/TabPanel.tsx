import React, { FC, useContext } from "react";
import { TabId } from "./Tabs";
import { TabsContext } from "./TabsContext";

// type TabPanelCssProps = {};

export type TabPanelProps = {
  tabId: TabId;
  children: React.ReactNode;
}; // & TabPanelCssProps;

const TabPanel: FC<TabPanelProps> = ({ tabId, children }) => {
  const { selectedTabId } = useContext(TabsContext);

  return tabId === selectedTabId ? <>{children}</> : null;
};

TabPanel.displayName = "Tabs.TabPanel";

export { TabPanel };
