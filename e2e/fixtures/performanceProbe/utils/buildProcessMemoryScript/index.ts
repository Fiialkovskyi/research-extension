/**
 * Builds the chrome-context script that lists Firefox's child processes with
 * their type and memory, as JSON. The add-on's background runs in the one of
 * type `extension`, shared with Firefox's built-in add-ons.
 */
export const buildProcessMemoryScript = (): string => `
  return ChromeUtils.requestProcInfo().then((info) =>
    JSON.stringify(info.children.map(({ type, memory }) => ({ type, memory }))),
  );
`;
