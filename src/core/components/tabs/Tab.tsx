import React, { FC, useContext } from "react";
import classNames from "classnames";
import { TabId } from "./Tabs";
import { TabsContext } from "./TabsContext";

type TabCssProps = {
  isActive?: boolean;
  children: React.ReactNode;
};

export type TabProps = {
  tabId: TabId;
} & TabCssProps;

const Tab: FC<TabProps> = ({ tabId, isActive, children, ...rest }) => {
  const { selectedTabId, setSelectedTabId } = useContext(TabsContext);

  const className = classNames({
    "is-active": isActive || selectedTabId === tabId,
  });

  return (
    <li className={className} {...rest}>
      <a onClick={(): void => setSelectedTabId(tabId)}>{children}</a>
    </li>
  );
};

Tab.displayName = "Tabs.Tab";

export { Tab };
