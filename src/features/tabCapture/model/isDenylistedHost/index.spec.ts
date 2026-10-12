import { describe, expect, it } from "vitest";

import { isDenylistedHost } from ".";
import { CAPTURE_DENYLIST, type CaptureDenylist } from "@/shared/config";

const DENYLIST: CaptureDenylist = {
  version: "capture_denylist@test",
  categories: [
    {
      name: "banking",
      domains: ["chase.com", "hsbc.*"],
      suffixes: [],
      words: ["bank"],
    },
    {
      name: "government",
      domains: [],
      suffixes: ["gov", "gov.uk"],
      words: [],
    },
  ],
};

const isListed = (hostname: string) => isDenylistedHost(hostname, DENYLIST);

describe("isDenylistedHost", () => {
  it("lists a domain and every subdomain of it", () => {
    expect(isListed("chase.com")).toBe(true);
    expect(isListed("secure.chase.com")).toBe(true);
  });

  it("does not take a host that merely ends with the same letters for the domain", () => {
    expect(isListed("purchase.com")).toBe(false);
    expect(isListed("chase.com.example.org")).toBe(false);
  });

  it("lists a name under any top-level domain, with or without subdomains", () => {
    expect(isListed("hsbc.de")).toBe(true);
    expect(isListed("www.hsbc.co.uk")).toBe(true);
    expect(isListed("hsbcfans.com")).toBe(false);
  });

  it("lists every host under a suffix", () => {
    expect(isListed("www.irs.gov")).toBe(true);
    expect(isListed("www.gov.uk")).toBe(true);
    expect(isListed("gov.example.org")).toBe(false);
  });

  it("lists a host one of whose labels contains a word", () => {
    expect(isListed("online.examplebank.de")).toBe(true);
    expect(isListed("bank.example")).toBe(true);
  });

  it("ignores case and a trailing dot", () => {
    expect(isListed("Secure.CHASE.com.")).toBe(true);
  });

  it("leaves ordinary research hosts and addresses alone", () => {
    expect(isListed("en.wikipedia.org")).toBe(false);
    expect(isListed("example.org")).toBe(false);
    expect(isListed("127.0.0.1")).toBe(false);
    expect(isListed("localhost")).toBe(false);
  });

  it("covers each category of the bundled list", () => {
    for (const host of [
      "www.paypal.com",
      "www.mychart.org",
      "www.irs.gov",
      "mail.google.com",
      "vault.bitwarden.com",
    ]) {
      expect(isDenylistedHost(host, CAPTURE_DENYLIST), host).toBe(true);
    }

    expect(isDenylistedHost("en.wikipedia.org", CAPTURE_DENYLIST)).toBe(false);
    expect(isDenylistedHost("www.google.com", CAPTURE_DENYLIST)).toBe(false);
  });
});
