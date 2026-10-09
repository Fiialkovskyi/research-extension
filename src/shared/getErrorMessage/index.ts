/**
 * Reads a person-readable message out of whatever a `catch` received.
 *
 * A caught value is `unknown`: code we call may throw something that is not an
 * `Error`. This is the one place that decides what such a value reads as, so
 * every failure reason a surface shows is derived the same way.
 */
export const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};
