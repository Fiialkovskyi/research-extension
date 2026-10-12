/**
 * Builds the script, evaluated inside the popup document, that clicks the
 * button with the given test id and reports whether there was one to click.
 */
export const buildPopupButtonClickScript = (testId: string): string => {
  return `
    const button = document.querySelector(${JSON.stringify(`[data-testid="${testId}"]`)});
    if (!button) { return JSON.stringify({ clicked: false }); }
    button.click();
    return JSON.stringify({ clicked: true });
  `;
};
