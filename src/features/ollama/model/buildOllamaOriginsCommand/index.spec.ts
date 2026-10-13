import { describe, expect, it } from "vitest";

import { buildOllamaOriginsCommand } from ".";

const ORIGIN = "moz-extension://0f8e7a1c-1111-4222-8333-944455556666";

describe("buildOllamaOriginsCommand", () => {
  it.each(["mac", "linux", "win"] as const)(
    "on %s, admits only this extension, never every extension",
    (platform) => {
      const { command } = buildOllamaOriginsCommand(platform, ORIGIN);

      expect(command).toContain(ORIGIN);
      expect(command).not.toContain("moz-extension://*");
    },
  );

  it("on macOS, persists the setting with a login agent and reopens Ollama itself", () => {
    const { command, afterward } = buildOllamaOriginsCommand("mac", ORIGIN);

    expect(command).toContain(`launchctl setenv OLLAMA_ORIGINS "${ORIGIN}"`);
    expect(command).toContain("~/Library/LaunchAgents/research-graph.ollama-origins.plist");
    expect(command).toContain("<key>RunAtLoad</key><true/>");
    expect(command).toMatch(/killall Ollama ollama.*open -a Ollama$/u);
    expect(afterward).toBeUndefined();
  });

  it("on Linux, overrides the service's environment and restarts it", () => {
    const { command } = buildOllamaOriginsCommand("linux", ORIGIN);

    expect(command).toContain(`Environment="OLLAMA_ORIGINS=${ORIGIN}"`);
    expect(command).toContain("sudo systemctl restart ollama");
  });

  it("on Windows, persists the variable and says to reopen Ollama", () => {
    const result = buildOllamaOriginsCommand("win", ORIGIN);

    expect(result.command).toBe(`setx OLLAMA_ORIGINS "${ORIGIN}"`);
    expect(result.afterward).toContain("open it again");
  });
});
