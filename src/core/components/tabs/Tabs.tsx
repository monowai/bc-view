import React, { FC, useState } from "react";
import { Tab, TabProps } from "./Tab";
import { TabList, TabListProps } from "./TabList";
import { TabPanel, TabPanelProps } from "./TabPanel";
import { TabsContext } from "./TabsContext";

type TabsComposition = {
  Tab: FC<TabProps>;
  TabList: FC<TabListProps>;
  TabPanel: FC<TabPanelProps>;
};

export type TabId = string | number | {};

export type TabsProps = {
  defaultTabId: TabId;
  children: React.ReactNode;
};

const Tabs: FC<TabsProps> & TabsComposition = ({ defaultTabId, children }) => {
  const [selectedTabId, setSelectedTabId] = useState<TabId>(defaultTabId);

  return (
    <TabsContext.Provider
      value={{
        selectedTabId,
        setSelectedTabId: (tabId): void => setSelectedTabId(tabId),
      }}
    >
      {children}
    </TabsContext.Provider>
  );
};

Tabs.Tab = Tab;
Tabs.TabList = TabList;
Tabs.TabPanel = TabPanel;

Tabs.displayName = "Tabs";

export { Tabs };
