/** The operating systems the setup command is written for, as `runtime.getPlatformInfo` names them. */
export type OllamaPlatform = "mac" | "linux" | "win";

/** A command the user pastes once, and what to do after it. */
export interface OllamaOriginsCommand {
  /** Where to paste it, in plain words. */
  where: string;
  command: string;
  /** What to do once it has run, or `undefined` when the command does it all. */
  afterward: string | undefined;
}

/** Names the LaunchAgent so a later run replaces it rather than adding another. */
const LAUNCH_AGENT_LABEL = "research-graph.ollama-origins";

/**
 * Builds the one command that lets Ollama answer this extension, and keeps it
 * that way after the computer restarts.
 *
 * It names only this installation's own origin — never `moz-extension://*`,
 * which would let every installed extension drive the local server. It sets
 * Ollama's `OLLAMA_ORIGINS` and so replaces any value the user had there.
 *
 * - **macOS:** sets the variable for the running session, installs a
 *   LaunchAgent that sets it again at every login (`launchctl setenv` alone is
 *   forgotten on restart), then quits and reopens Ollama so it reads it.
 * - **Linux:** a systemd override for the `ollama` service, then a restart.
 * - **Windows:** `setx`, which persists for the user; Ollama is then reopened
 *   by hand from the tray.
 *
 * @param extensionOrigin This installation's origin, such as
 *   `moz-extension://0f8e…`, without a trailing slash.
 */
export const buildOllamaOriginsCommand = (
  platform: OllamaPlatform,
  extensionOrigin: string,
): OllamaOriginsCommand => {
  switch (platform) {
    case "mac": {
      const plist = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<plist version="1.0"><dict><key>Label</key><string>${LAUNCH_AGENT_LABEL}</string>`,
        "<key>ProgramArguments</key><array><string>/bin/launchctl</string><string>setenv</string>",
        `<string>OLLAMA_ORIGINS</string><string>${extensionOrigin}</string></array>`,
        "<key>RunAtLoad</key><true/></dict></plist>",
      ].join("");

      return {
        where:
          "Open the Terminal app (press ⌘ Space, type Terminal, press Return), paste this, and press Return:",
        command: [
          `launchctl setenv OLLAMA_ORIGINS "${extensionOrigin}"`,
          "mkdir -p ~/Library/LaunchAgents",
          `printf '%s\\n' '${plist}' > ~/Library/LaunchAgents/${LAUNCH_AGENT_LABEL}.plist`,
          // Not `osascript -e 'quit app "Ollama"'`: Ollama answers that with
          // "User canceled" and keeps running, so it never reads the variable.
          // Both the app and its server are stopped, the app restarting both.
          "killall Ollama ollama 2>/dev/null",
          "sleep 2",
          "open -a Ollama",
        ].join("; "),
        afterward: undefined,
      };
    }
    case "linux":
      return {
        where: "Open a terminal, paste this, and press Enter (it asks for your password):",
        command: [
          "sudo mkdir -p /etc/systemd/system/ollama.service.d",
          `printf '[Service]\\nEnvironment="OLLAMA_ORIGINS=${extensionOrigin}"\\n' | sudo tee /etc/systemd/system/ollama.service.d/research-graph.conf > /dev/null`,
          "sudo systemctl daemon-reload",
          "sudo systemctl restart ollama",
        ].join(" && "),
        afterward: undefined,
      };
    case "win":
      return {
        where:
          "Open Command Prompt (press the Windows key, type cmd, press Enter), paste this, and press Enter:",
        command: `setx OLLAMA_ORIGINS "${extensionOrigin}"`,
        afterward: "Then quit Ollama from the icon by the clock, and open it again.",
      };
  }
};
