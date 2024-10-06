import { ObjectSchema } from "yup"

export const validateInput = async <T>(
  schema: ObjectSchema<any>,
  input: any,
): Promise<T> => {
  await schema.validate(input, { abortEarly: false })
  return schema.cast(input)
}
