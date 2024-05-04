import React from "react";
import { TabId } from "./Tabs";

export type Context = {
  selectedTabId: TabId;
  setSelectedTabId: (tabId: TabId) => void;
};

export const TabsContext = React.createContext<Context>({
  selectedTabId: "",
  setSelectedTabId: () => {},
});
