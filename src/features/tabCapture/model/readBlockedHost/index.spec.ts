import { describe, expect, it } from "vitest";

import { isCapturableUrl } from "../isCapturableUrl";
import { readBlockedHost } from ".";

describe("readBlockedHost", () => {
  it.each([
    ["https://www.paypal.com/myaccount", "www.paypal.com"],
    ["http://www.paypal.com:8080/b.html", "www.paypal.com"],
    ["https://mail.google.com/mail/u/0/", "mail.google.com"],
    ["https://www.irs.gov/", "www.irs.gov"],
    ["https://chase.com./login", "chase.com"],
    ["https://MyBank.Example/", "mybank.example"],
  ])("names the host of %s", (url, host) => {
    expect(readBlockedHost(url)).toBe(host);
  });

  it("names the host of a site the user added and of its subdomains, not of a look-alike", () => {
    const sites = ["myclinic.example"];

    expect(readBlockedHost("https://myclinic.example/", sites)).toBe("myclinic.example");
    expect(readBlockedHost("https://portal.myclinic.example/a", sites)).toBe(
      "portal.myclinic.example",
    );
    expect(readBlockedHost("https://notmyclinic.example/", sites)).toBeUndefined();
  });

  it.each([
    "https://example.org/a",
    "https://en.wikipedia.org/wiki/Electric_bicycle",
    "about:preferences",
    "moz-extension://uuid/popup.html",
    "file:///Users/me/notes.html",
    "data:text/html,<p>hi</p>",
    "not a url",
    undefined,
  ])("names no host for %s", (url) => {
    expect(readBlockedHost(url)).toBeUndefined();
  });

  it("agrees with isCapturableUrl: a web page is blocked exactly when it is refused", () => {
    const sites = ["myclinic.example"];

    for (const url of [
      "https://example.org/",
      "https://www.paypal.com/",
      "https://myclinic.example/x",
      "https://purchase.com/",
      "http://127.0.0.1:8080/b.html",
    ]) {
      expect(readBlockedHost(url, sites) !== undefined).toBe(!isCapturableUrl(url, sites));
    }
  });
});
