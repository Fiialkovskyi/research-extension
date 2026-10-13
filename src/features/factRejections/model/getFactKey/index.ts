import { readNormalizedValue } from "@/features/entityResolution";
import { normalizeEntityName } from "@/shared/normalizeEntityName";

/** What a fact states, as its key is built from it. */
export interface StatedFact {
  subject: string;
  attribute: string;
  value: string;
  unit?: string;
}

/**
 * The key a rejection is stored under (`factKey@1`, REQ-LIN-008): the SHA-256,
 * hex, of the fact's subject and attribute, normalised, and its value — in its
 * base unit when it is a number, rounded to 6 significant digits, normalised
 * text otherwise. Equal only for the same statement however it is written:
 * no tolerance, so two values near each other stay two keys.
 */
export const getFactKey = async ({
  subject,
  attribute,
  value,
  unit,
}: StatedFact): Promise<string> => {
  const number = readNormalizedValue(value, unit);
  const statedValue =
    number === undefined
      ? normalizeEntityName(`${value} ${unit ?? ""}`)
      : `${Number(number.number.toPrecision(6))} ${number.unit}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      [normalizeEntityName(subject), normalizeEntityName(attribute), statedValue].join("|"),
    ),
  );

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
