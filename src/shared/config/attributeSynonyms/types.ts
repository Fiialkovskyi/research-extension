/**
 * One thing a spec sheet states, as the languages the pages come in name it
 * (`attributeSynonyms@1`). An attribute joins the entry when its normalised
 * name equals one of `exact`, or holds one of `phrases` as whole words; the
 * first entry that matches wins, so a narrower entry stands before a wider one.
 * A `variant` is a thing one product comes in several of, such as a storage
 * size or a colour, so several values are options and not a disagreement.
 */
export interface AttributeSynonym {
  key: string;
  phrases: readonly string[];
  exact?: readonly string[];
  variant?: true;
}
