/**
 * Recognises the packaged extension among WXT's zip output.
 *
 * `wxt zip -b firefox` writes two archives — the extension and a sources zip
 * for AMO review — and only the first ends in "-firefox.zip". Matching that
 * suffix, rather than a bare "firefox" substring, keeps a package whose own
 * name contains "firefox" from also matching the sources zip beside it.
 */
export const isFirefoxPackage = (entry: string): boolean => {
  return entry.endsWith("-firefox.zip");
};
