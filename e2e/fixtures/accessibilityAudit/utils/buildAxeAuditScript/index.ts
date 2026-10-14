import { AXE_RULE_TAGS } from "../../constants";

/**
 * Builds the script that loads axe into the page and audits the document
 * against {@link AXE_RULE_TAGS}, resolving to the violations as JSON. Passed to
 * WebDriver as a function body, so the page's own policy, which forbids eval,
 * does not apply to it.
 */
export const buildAxeAuditScript = (axeSource: string): string => `
  ${axeSource}
  return window.axe
    .run(document, { runOnly: { type: "tag", values: ${JSON.stringify(AXE_RULE_TAGS)} } })
    .then((result) =>
      JSON.stringify(
        result.violations.map(({ id, impact, help, nodes }) => ({
          id,
          impact: impact ?? null,
          help,
          targets: nodes.map(({ target }) => target.join(" ")),
        })),
      ),
    );
`;
