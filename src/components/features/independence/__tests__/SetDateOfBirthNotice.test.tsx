import React from "react"
import { render, screen } from "@testing-library/react"
import SetDateOfBirthNotice from "../SetDateOfBirthNotice"

describe("SetDateOfBirthNotice", () => {
  it("links to the profile settings view", () => {
    render(<SetDateOfBirthNotice />)
    const link = screen.getByRole("link", { name: /set date of birth/i })
    expect(link).toHaveAttribute("href", "/independence?view=profile")
  })
})
