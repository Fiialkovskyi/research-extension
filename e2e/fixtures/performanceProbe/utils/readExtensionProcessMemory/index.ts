import { browser } from "@wdio/globals";

import { buildMinimizeMemoryScript } from "../buildMinimizeMemoryScript";
import { buildProcessMemoryScript } from "../buildProcessMemoryScript";
import { parseProcessMemory } from "../parseProcessMemory";

/**
 * Reads the extension process's memory, in bytes, after minimising memory
 * everywhere. Must be called in the chrome context.
 */
export const readExtensionProcessMemory = async (): Promise<number> => {
  await browser.executeScript(buildMinimizeMemoryScript(), []);

  return parseProcessMemory(await browser.executeScript(buildProcessMemoryScript(), []));
};
