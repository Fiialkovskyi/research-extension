import { browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import { UI_TIMEOUT_MS } from "../../../firefoxToolbar/constants";
import { AUDIT_SETTLE_MS } from "../../constants";
import { buildAxeAuditScript } from "../buildAxeAuditScript";
import { type AxeViolation, parseAxeViolations } from "../parseAxeViolations";
import { readAxeSource } from "../readAxeSource";

/**
 * Loads an extension page in the current tab and audits it with axe. Must be
 * called in the content context.
 *
 * @param pagePath The page's path inside the package, such as `options.html`.
 * @param prepareScript Run in the page before the audit; the suite's control
 *   uses it to plant a known violation.
 */
export const auditExtensionPage = async (
  pagePath: string,
  prepareScript?: string,
): Promise<AxeViolation[]> => {
  await browser.url(getExtensionUrl(pagePath));
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === "complete",
    {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: `${pagePath} never finished loading.`,
    },
  );
  await browser.pause(AUDIT_SETTLE_MS);

  if (prepareScript !== undefined) {
    await browser.execute(prepareScript);
  }

  return parseAxeViolations(await browser.execute(buildAxeAuditScript(readAxeSource())));
};
