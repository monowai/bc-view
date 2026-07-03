/**
 * Shared Tailwind class strings for form inputs.
 * Using explicit string literals so Tailwind's class scanner picks them up.
 */

/**
 * Base input classes without a border colour.
 * Use in template literals where the border colour is conditional, e.g.:
 *   className={`${INPUT_CLS_BASE} ${error ? "border-red-500" : "border-gray-300"}`}
 */
export const INPUT_CLS_BASE =
  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"

/**
 * Full input class string for inputs with a fixed grey border.
 * Use as:  className={INPUT_CLS}
 * Or with extra classes:  className={`${INPUT_CLS} extra-class`}
 */
export const INPUT_CLS =
  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 border-gray-300"
