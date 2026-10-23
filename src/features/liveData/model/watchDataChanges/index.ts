import { buildRpcMessage, parseRpcMessage, RpcMessageError } from "@/shared/rpc";

import { DATA_TOPICS } from "../../constants";
import { liveDataResponseSchemas } from "../../schemas";
import type { DataTopic } from "../../types";

/** The part of a browser port this module uses. */
export interface WatchablePort {
  postMessage: (message: unknown) => void;
  onMessage: { addListener: (listener: (message: unknown) => void) => void };
  onDisconnect: { addListener: (listener: () => void) => void };
  disconnect: () => void;
}

export interface WatchDataChangesOptions {
  /** Opens a port to the background. Called again when the background went away. */
  connect: () => WatchablePort;
  /** Told which kinds of data changed; every kind after a reconnect, since changes may have been missed. */
  onChange: (topics: readonly DataTopic[]) => void;
  /** How long to wait before connecting again. */
  reconnectDelayMs?: number;
}

/**
 * Follows the background's notifications that data changed, for as long as the
 * returned function is not called.
 *
 * The background can be unloaded at any time and takes its ports with it, so a
 * dropped port is opened again, and the page told that anything may have
 * changed meanwhile.
 *
 * @returns A function that stops following.
 */
export const watchDataChanges = ({
  connect,
  onChange,
  reconnectDelayMs = 1_000,
}: WatchDataChangesOptions): (() => void) => {
  let isStopped = false;
  let port: WatchablePort | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = (): void => {
    const opened = connect();

    port = opened;
    opened.onMessage.addListener((message) => {
      try {
        const response = parseRpcMessage(message, liveDataResponseSchemas);

        onChange(response.payload.topics);
      } catch (error) {
        if (!(error instanceof RpcMessageError)) {
          throw error;
        }
      }
    });
    opened.onDisconnect.addListener(() => {
      if (isStopped) {
        return;
      }

      timer = setTimeout(() => {
        open();
        onChange(DATA_TOPICS);
      }, reconnectDelayMs);
    });
    // A browser extension port, not a window: it has no target origin.
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    opened.postMessage(buildRpcMessage("data.subscribe", {}));
  };

  open();

  return () => {
    isStopped = true;
    clearTimeout(timer);
    port?.disconnect();
  };
};
