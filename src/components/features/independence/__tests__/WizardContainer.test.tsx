import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import ExpensesStep from "../steps/ExpensesStep"
import {
  expensesStepSchema,
  defaultWizardValues,
} from "@lib/independence/schema"
import { WizardFormData } from "types/independence"

// Mock SWR
const mockCategories = {
  data: [
    {
      id: "cat-1",
      ownerId: "SYSTEM",
      name: "Housing",
      sortOrder: 1,
      description: "Rent, mortgage",
    },
  ],
}

jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({
    data: mockCategories,
    error: null,
    isLoading: false,
  }),
}))

interface TestWrapperProps {
  onGetValues?: (getValues: () => any) => void
}

const TestWrapper: React.FC<TestWrapperProps> = ({ onGetValues }) => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(expensesStepSchema) as any,
    defaultValues: {
      ...defaultWizardValues,
      expenses: [],
    },
    mode: "onBlur",
  })

  // Expose getValues to parent
  React.useEffect(() => {
    if (onGetValues) {
      onGetValues(methods.getValues)
    }
  }, [onGetValues, methods.getValues])

  return (
    <FormProvider {...methods}>
      <form>
        <ExpensesStep
          control={methods.control}
          errors={methods.formState.errors}
          setValue={methods.setValue}
          getValues={methods.getValues}
        />
      </form>
    </FormProvider>
  )
}

describe("ExpensesStep - Custom Category", () => {
  it("captures custom category with correct monetary value", async () => {
    jest.setTimeout(15000) // Increase timeout for CI environments
    let getValuesFn: (() => any) | null = null

    render(
      <TestWrapper
        onGetValues={(fn) => {
          getValuesFn = fn
        }}
      />,
    )

    // Wait for categories to load and Housing to appear
    await waitFor(() => {
      expect(screen.getByText("Housing")).toBeInTheDocument()
    })

    // Add a custom category
    fireEvent.click(
      screen.getByRole("button", { name: /add custom category/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter custom category name/i),
      ).toBeInTheDocument()
    })

    fireEvent.change(
      screen.getByPlaceholderText(/enter custom category name/i),
      {
        target: { value: "Pet Insurance" },
      },
    )

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /^add$/i }))
    })

    // Wait for custom category to appear
    await waitFor(() => {
      expect(screen.getByText("Pet Insurance")).toBeInTheDocument()
    })

    // Find the input for the custom category (last one) and enter a value
    const inputs = screen.getAllByRole("spinbutton")
    const customCategoryInput = inputs[inputs.length - 1]

    // Verify initial value is empty (zero displays as empty)
    expect(customCategoryInput).toHaveValue(null)

    // Change the value
    act(() => {
      fireEvent.change(customCategoryInput, { target: { value: "75" } })
    })

    // Verify the input value changed
    expect(customCategoryInput).toHaveValue(75)

    // Get form values and check
    expect(getValuesFn).not.toBeNull()
    const formValues = getValuesFn!()

    // Find the custom expense
    const customExpense = formValues.expenses.find((e: any) =>
      e.categoryLabelId?.startsWith("custom-"),
    )

    expect(customExpense).toBeDefined()
    expect(customExpense.categoryName).toBe("Pet Insurance")
    expect(customExpense.monthlyAmount).toBe(75)
  })
})
