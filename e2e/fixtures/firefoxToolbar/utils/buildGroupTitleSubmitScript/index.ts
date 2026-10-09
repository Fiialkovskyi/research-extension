/**
 * Builds the script, evaluated inside the popup document, that types a session
 * title and submits the form.
 *
 * The value is set through the native setter and announced with an `input`
 * event, which is what React listens to; assigning `value` alone would leave
 * React's state, and so the submit button, unaware of it. The form is then
 * submitted the way Enter would, and the script reports whether a form was
 * there to submit.
 */
export const buildGroupTitleSubmitScript = (title: string): string => {
  return `
    const input = document.querySelector('[data-testid="group-title"]');
    const form = document.querySelector('[data-testid="group-form"]');
    if (!input || !form) { return JSON.stringify({ submitted: false }); }
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setValue.call(input, ${JSON.stringify(title)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.requestSubmit();
    return JSON.stringify({ submitted: true });
  `;
};
