/**
 * Builds the script, evaluated inside the popup document, that chooses an
 * option in the session picker and reports whether there was one to choose.
 *
 * The value goes in through the select's own setter and is announced with a
 * bubbling `change` event, which is what React listens to.
 */
export const buildPopupSessionSelectScript = (label: string): string => {
  return `
    const select = document.querySelector('[data-testid="session-select"]');
    const option = Array.from(select?.options ?? []).find((entry) => entry.textContent.includes(${JSON.stringify(label)}));
    if (!select || !option) { return JSON.stringify({ selected: false }); }
    const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setValue.call(select, option.value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return JSON.stringify({ selected: true });
  `;
};
