/**
 * Builds the chrome-context script that takes away an add-on's access to every
 * page, the way the user switching the permission off in `about:addons` does:
 * the grant is removed and the running add-on is told, so its
 * `permissions.onRemoved` fires.
 *
 * Returns a promise, which the classic protocol's script execution awaits.
 */
export const buildPageAccessRevokeScript = (extensionId: string): string => `
  const { ExtensionPermissions } = ChromeUtils.importESModule(
    "resource://gre/modules/ExtensionPermissions.sys.mjs",
  );
  const policy = WebExtensionPolicy.getByID(${JSON.stringify(extensionId)});
  if (!policy) {
    throw new Error("The add-on " + ${JSON.stringify(extensionId)} + " is not installed.");
  }
  return ExtensionPermissions.remove(
    ${JSON.stringify(extensionId)},
    { permissions: [], origins: ["<all_urls>"] },
    policy.extension,
  ).then(() => true);
`;
