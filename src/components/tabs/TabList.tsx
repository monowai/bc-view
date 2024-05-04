import React, { FC } from "react";
import classNames from "classnames";

type TabsAlignment = "centered" | "right";
type TabsSize = "small" | "medium" | "large";

type TabListCssProps = {
  isAlign?: TabsAlignment;
  isSize?: TabsSize;
  isBoxed?: boolean;
  isToggle?: boolean;
  isToggleRounded?: boolean;
  isFullwidth?: boolean;
  children: React.ReactNode;
};

export type TabListProps = {} & TabListCssProps;

const TabList: FC<TabListProps> = ({
  isAlign,
  isSize,
  isBoxed,
  isToggle,
  isToggleRounded,
  isFullwidth,
  children,
  ...rest
}) => {
  const className = classNames("tabs", {
    [`is-${isAlign}`]: isAlign,
    [`is-${isSize}`]: isSize,
    "is-boxed": isBoxed,
    "is-toggle": isToggle,
    "is-toggle-rounded": isToggleRounded,
    "is-fullwidth": isFullwidth,
  });

  return (
    <div className={className} {...rest}>
      <ul>{children}</ul>
    </div>
  );
};

TabList.displayName = "Tabs.TabList";

export { TabList };
