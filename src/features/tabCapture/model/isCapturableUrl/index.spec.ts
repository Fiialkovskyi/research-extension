import { describe, expect, it } from "vitest";

import { isCapturableUrl } from ".";

describe("isCapturableUrl", () => {
  it.each([
    "https://example.org/a",
    "http://127.0.0.1:8080/b.html",
    "http://en.wikipedia.org/wiki/Electric_bicycle",
  ])("captures %s", (url) => {
    expect(isCapturableUrl(url)).toBe(true);
  });

  it.each([
    "about:newtab",
    "about:blank",
    "moz-extension://uuid/popup.html",
    "file:///Users/me/notes.html",
    "data:text/html,<p>hi</p>",
    "not a url",
    undefined,
    "https://www.paypal.com/myaccount",
    "http://www.paypal.com:8080/b.html",
    "https://www.irs.gov/",
    "https://mail.google.com/mail/u/0/",
  ])("never captures %s", (url) => {
    expect(isCapturableUrl(url)).toBe(false);
  });

  it("refuses a site the user added and its subdomains, but not a look-alike", () => {
    const sites = ["myclinic.example"];

    expect(isCapturableUrl("https://myclinic.example/", sites)).toBe(false);
    expect(isCapturableUrl("https://portal.myclinic.example/a", sites)).toBe(false);
    expect(isCapturableUrl("https://notmyclinic.example/", sites)).toBe(true);
  });
});
