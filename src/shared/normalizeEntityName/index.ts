/**
 * Writes an entity's name the way two spellings of the same name agree
 * (`entityName@1`): compatibility-normalised (full-width letters, ligatures),
 * case-folded, with quotes, inch marks and other punctuation turned into
 * spaces — except a point or comma between two digits, which is part of a
 * number such as "2.5" — and whitespace collapsed.
 */
export const normalizeEntityName = (name: string): string =>
  name
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replaceAll(/(?<=\d)[.,](?=\d)/gu, "\u0000")
    .replaceAll(/[\p{P}\p{S}]/gu, " ")
    .replaceAll("\u0000", ".")
    .replaceAll(/\s+/gu, " ")
    .trim();
