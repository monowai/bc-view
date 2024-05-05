import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRouter } from "next/router";
import "@testing-library/jest-dom";
import { HoldingOptions } from "@components/holdings/HoldingOptions";

jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

// Mocking your internal components
jest.mock("@components/Portfolios", () => ({
  Portfolios: () => <div>MockPortfolios</div>,
}));

// jest.mock("@components/GroupByOptions", () => ({
//   GroupByOptions: () => <div>MockGroupByOption</div>,
// }));

jest.mock("@components/HideEmpty", () => ({
  HideEmpty: () => <div>MockHideEmpty</div>,
}));

describe("<HoldingOptions />", () => {
  const mockPush = jest.fn();
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });
  const portfolio = {
    id: "123",
    code: "CODE",
    name: "Portfolio A",
    currency: { code: "USD", name: "USD", symbol: "$" },
    base: { code: "USD", name: "USD", symbol: "$" },
  };

  it("renders correctly with provided portfolio", () => {
    render(<HoldingOptions portfolio={portfolio} />);

    expect(screen.getByText("option.portfolio")).toBeInTheDocument();
    expect(screen.getByText("MockPortfolios")).toBeInTheDocument();
    expect(screen.getByText("holdings.groupBy")).toBeInTheDocument();
    // expect(screen.getByText("MockGroupByOption")).toBeInTheDocument();
    expect(screen.getByText("holdings.openOnly")).toBeInTheDocument();
    expect(screen.getByText("MockHideEmpty")).toBeInTheDocument();
    expect(screen.getByText("trn.add")).toBeInTheDocument();
  });

  it("navigates to transaction page when add transaction button is clicked", async () => {
    render(<HoldingOptions portfolio={portfolio} />);

    fireEvent.click(screen.getByText("trn.add"));
    expect(mockPush).toHaveBeenCalledWith("/trns");
  });
});
