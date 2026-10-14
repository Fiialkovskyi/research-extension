import { EGRESS_LOG_PROPERTY, EGRESS_OBSERVER_TOPIC } from "../../constants";

/**
 * Builds the chrome-context script that starts recording every HTTP request
 * the add-on triggers (REQ-SEC-001 to SEC-003): from its pages, its workers or
 * its content scripts, whose principal names the add-on directly or within an
 * expanded principal. Idempotent; each run empties the log.
 */
export const buildEgressRecorderScript = (extensionId: string): string => `
  const extensionId = ${JSON.stringify(extensionId)};
  const holder = Services.appShell.hiddenDOMWindow;
  if (!holder.${EGRESS_LOG_PROPERTY}) {
    const log = [];
    const readAddonId = (principal) => {
      if (!principal) {
        return "";
      }
      if (principal.addonId) {
        return principal.addonId;
      }
      if (principal.isExpandedPrincipal) {
        const expanded = principal.QueryInterface(Ci.nsIExpandedPrincipal);
        for (const inner of expanded.allowlist) {
          if (inner.addonId) {
            return inner.addonId;
          }
        }
      }
      return "";
    };
    const observer = {
      observe(subject) {
        const channel = subject.QueryInterface(Ci.nsIHttpChannel);
        const info = channel.loadInfo;
        if (!info) {
          return;
        }
        const ids = [readAddonId(info.triggeringPrincipal), readAddonId(info.loadingPrincipal)];
        if (ids.includes(extensionId)) {
          log.push({ url: channel.URI.spec, type: info.externalContentPolicyType });
        }
      },
    };
    Services.obs.addObserver(observer, ${JSON.stringify(EGRESS_OBSERVER_TOPIC)});
    holder.${EGRESS_LOG_PROPERTY} = { log, observer };
  }
  holder.${EGRESS_LOG_PROPERTY}.log.length = 0;
  return true;
`;
