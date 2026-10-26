/**
 * The requests that change what a page shows, so that once one is handled every
 * open page is told to read again. Reads are left out on purpose: a page reads
 * in answer to a notification, and a read that notified would answer itself.
 */
export const DATA_CHANGING_REQUESTS: ReadonlySet<string> = new Set([
  "aiActivity.runNow",
  "aiSetup.collapseBanner",
  "aiSetup.start",
  "aiSetup.turnOn",
  "denylist.save",
  "entity.separate",
  "facts.extractNow",
  "facts.reject",
  "facts.restoreRejections",
  "model.activate",
  "model.install",
  "node.delete",
  "ollama.enable",
  "ollama.pull",
  "ollama.register",
  "questions.refresh",
  "session.delete",
  "session.keepSeparate",
  "session.reattach",
  "session.resume",
  "session.view",
  "spaces.remove",
  "summaries.refresh",
  "tabGroup.create",
  "table.setColumns",
]);

/** Why an in-extension model is refused while that backend is switched off. */
export const IN_BROWSER_BACKEND_OFF_REASON =
  "Models that run inside the extension are switched off; AI runs through Ollama.";
