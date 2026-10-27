/**
 * Splits a value into the words and numbers that identify it, lower-cased, with
 * a decimal comma read as a point: `6,3″` and `6.3"` are both `6.3`, and
 * `2424 x 1080` is `2424`, `x`, `1080`.
 */
export const readValueTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replaceAll(/(\d),(\d)/gu, "$1.$2")
    .split(/[^\p{L}\p{N}.]+/u)
    .map((token) => token.replaceAll(/^\.+|\.+$/gu, ""))
    .filter((token) => token !== "");
