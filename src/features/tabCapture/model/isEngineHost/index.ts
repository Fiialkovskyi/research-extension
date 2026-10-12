/** A top-level domain of one or two labels, such as `de` or `co.uk`. */
const TOP_LEVEL_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)?$/;

/**
 * Whether `hostname` is the engine host `host`. A `host` ending in `.*`
 * accepts its name under any top-level domain of one or two labels.
 */
export const isEngineHost = (hostname: string, host: string): boolean => {
  if (!host.endsWith(".*")) {
    return hostname === host;
  }

  const name = host.slice(0, -1);

  return hostname.startsWith(name) && TOP_LEVEL_DOMAIN.test(hostname.slice(name.length));
};
