/**
 * Reads a string field off a message that has not been validated.
 *
 * Needed because a refused message still has to be answered: without its
 * correlation id the sender waits for a reply that never comes, and without its
 * type the reason names nothing useful. Everything here is defensive — the
 * value may be any shape at all — so a missing or non-string field reads as
 * absent rather than throwing and losing the chance to reply.
 */
export const readMessageField = (candidate: unknown, field: string): string | undefined => {
  if (typeof candidate !== "object" || candidate === null || !(field in candidate)) {
    return undefined;
  }

  // Narrowed above to a non-null object that has the field; the compiler cannot
  // express "an object with this key" without a cast.
  const value = (candidate as Record<string, unknown>)[field];

  return typeof value === "string" ? value : undefined;
};
