/** Text cut to a byte limit, and whether anything was cut. */
export interface TruncatedText {
  text: string;
  truncated: boolean;
}

/**
 * Cuts text to at most `maximumBytes` of UTF-8, never inside a character.
 *
 * Measured in bytes rather than characters because the limit bounds storage
 * and the message that carries the text, and both are bytes.
 */
export const truncateUtf8Text = (text: string, maximumBytes: number): TruncatedText => {
  const bytes = new TextEncoder().encode(text);

  if (bytes.byteLength <= maximumBytes) {
    return { text, truncated: false };
  }

  let end = maximumBytes;

  // A UTF-8 continuation byte is 10xxxxxx; cutting before one would split a
  // character, so the cut moves back to the start of that character.
  while (end > 0 && ((bytes[end] ?? 0) & 0b1100_0000) === 0b1000_0000) {
    end -= 1;
  }

  return { text: new TextDecoder().decode(bytes.subarray(0, end)), truncated: true };
};
