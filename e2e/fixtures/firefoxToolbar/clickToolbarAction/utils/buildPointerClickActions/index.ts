import { ELEMENT_KEY } from "../../../constants";

/**
 * Builds the WebDriver action sequence for a plain left click on an element.
 *
 * The click goes through the classic `performActions` command rather than
 * WebdriverIO's `.click()`, because element lookups in the chrome context
 * only exist as raw protocol references.
 */
export function buildPointerClickActions(elementId: string) {
  return [
    {
      type: "pointer" as const,
      id: "mouse",
      parameters: { pointerType: "mouse" as const },
      actions: [
        { type: "pointerMove" as const, origin: { [ELEMENT_KEY]: elementId }, x: 0, y: 0 },
        { type: "pointerDown" as const, button: 0 },
        { type: "pointerUp" as const, button: 0 },
      ],
    },
  ];
}
