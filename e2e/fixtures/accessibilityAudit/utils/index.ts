/**
 * Audits the extension's pages with axe against WCAG 2 A and AA (section 13).
 * Each function is a directory of its own with its unit test beside it. This
 * file is the public surface and holds no logic.
 */

export { auditExtensionPage } from "./auditExtensionPage";
export { type AxeViolation, parseAxeViolations } from "./parseAxeViolations";
