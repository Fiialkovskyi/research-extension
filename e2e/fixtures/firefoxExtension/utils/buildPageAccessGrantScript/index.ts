/**
 * Builds the chrome-context script that grants an add-on access to every
 * page, the way Firefox does when the user answers "Allow" to its prompt: the
 * grant is stored and the running add-on is told, so its
 * `permissions.onAdded` fires.
 *
 * Returns a promise, which the classic protocol's script execution awaits.
 */
export const buildPageAccessGrantScript = (extensionId: string): string => `
  const { ExtensionPermissions } = ChromeUtils.importESModule(
    "resource://gre/modules/ExtensionPermissions.sys.mjs",
  );
  const policy = WebExtensionPolicy.getByID(${JSON.stringify(extensionId)});
  if (!policy) {
    throw new Error("The add-on " + ${JSON.stringify(extensionId)} + " is not installed.");
  }
  return ExtensionPermissions.add(
    ${JSON.stringify(extensionId)},
    { permissions: [], origins: ["<all_urls>"] },
    policy.extension,
  ).then(() => true);
`;
