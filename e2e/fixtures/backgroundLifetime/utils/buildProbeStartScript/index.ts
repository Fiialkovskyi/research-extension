/**
 * Builds the script, evaluated in the options page, that fills in the probe
 * card's strategy and hold and presses Start.
 *
 * The values are set through the elements' own value setters and announced
 * with the events React listens for: typing into a controlled number input
 * appends to what is there rather than replacing it.
 *
 * @returns The script; it returns `true` once Start was pressed, or the
 * missing element's test id.
 */
export const buildProbeStartScript = (strategy: string, holdSeconds: number): string => `
  const find = (id) => document.querySelector('[data-testid="' + id + '"]');
  const select = find("probe-strategy");
  const hold = find("probe-hold");
  const start = find("probe-start");
  if (!select) return "probe-strategy";
  if (!hold) return "probe-hold";
  if (!start) return "probe-start";
  const setValue = (element, prototype, value) => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  setValue(select, HTMLSelectElement.prototype, ${JSON.stringify(strategy)});
  setValue(hold, HTMLInputElement.prototype, ${JSON.stringify(String(holdSeconds))});
  start.click();
  return true;
`;
