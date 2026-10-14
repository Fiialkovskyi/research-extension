/**
 * Builds the chrome-context script that minimises memory in every process, as
 * about:memory's "Minimize memory usage" does, and resolves once done. Memory
 * is measured after it, so what is counted is what the add-on holds, not the
 * garbage the suite's own reads left behind.
 */
export const buildMinimizeMemoryScript = (): string => `
  const manager = Cc["@mozilla.org/memory-reporter-manager;1"].getService(
    Ci.nsIMemoryReporterManager,
  );
  return new Promise((resolve) => {
    manager.minimizeMemoryUsage(() => resolve(true));
  });
`;
