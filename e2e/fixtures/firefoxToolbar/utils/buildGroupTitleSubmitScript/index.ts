/**
 * Builds the script, evaluated inside the popup document, that types a session
 * title and submits the form, opening it first when it is behind the button.
 *
 * The value is set through the native setter and announced with an `input`
 * event, which is what React listens to; assigning `value` alone would leave
 * React's state, and so the submit button, unaware of it. The form is then
 * submitted the way Enter would, and the script reports whether a form was
 * there to submit.
 */
export const buildGroupTitleSubmitScript = (title: string): string => {
  return `
    // With saved sessions the form sits behind the new-session button; the
    // click re-renders synchronously, so the form is there on the next line.
    if (!document.querySelector('[data-testid="group-form"]')) {
      document.querySelector('[data-testid="session-new"]')?.click();
    }
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
