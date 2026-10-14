/**
 * Builds the chrome-context script that makes one request on the add-on's
 * behalf — loaded by its principal, as its own pages' requests are — so a run
 * can show the recorder sees the add-on's traffic before it asserts there is
 * none. Resolves once the response arrived or failed.
 */
export const buildEgressProbeScript = (extensionId: string, url: string): string => `
  const policy = WebExtensionPolicy.getByID(${JSON.stringify(extensionId)});
  if (!policy) {
    throw new Error("The add-on " + ${JSON.stringify(extensionId)} + " is not installed.");
  }
  const { NetUtil } = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");
  const channel = NetUtil.newChannel({
    uri: ${JSON.stringify(url)},
    loadingPrincipal: policy.extension.principal,
    securityFlags: Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_SEC_CONTEXT_IS_NULL,
    contentPolicyType: Ci.nsIContentPolicy.TYPE_OTHER,
  });
  return new Promise((resolve) => {
    NetUtil.asyncFetch(channel, () => resolve(true));
  });
`;
