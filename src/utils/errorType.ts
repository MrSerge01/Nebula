/**
 * Gives you an error with the Error type.
 * @param value Error with type unknown.
 * @returns Typed error.
 */
export function errorType(value: unknown): Error {
  if (Error.isError(value)) return value;

  try {
    const stringified = JSON.stringify(value);
    return new Error(stringified);
  } catch {
    return value as Error;
  }
}
