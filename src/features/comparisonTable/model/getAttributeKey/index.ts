import { normalizeEntityName } from "@/shared/normalizeEntityName";

import { ATTRIBUTE_SYNONYMS } from "../../constants";

/** Whether `name` holds `phrase` as whole words. */
const holdsPhrase = (name: string, phrase: string): boolean => ` ${name} `.includes(` ${phrase} `);

/**
 * The column an attribute falls in: the key of the synonym entry it names in
 * Ukrainian, Russian or English (`діафрагма` and `aperture` agree), else its
 * own normalised name. A name no entry lists keeps a column of its own, as it
 * did before the table existed.
 */
export const getAttributeKey = (attribute: string): string => {
  const name = normalizeEntityName(attribute);
  const entry = ATTRIBUTE_SYNONYMS.find(
    ({ phrases, exact }) =>
      (exact ?? []).some((spelling) => normalizeEntityName(spelling) === name) ||
      phrases.some((phrase) => holdsPhrase(name, normalizeEntityName(phrase))),
  );

  return entry?.key ?? name;
};
