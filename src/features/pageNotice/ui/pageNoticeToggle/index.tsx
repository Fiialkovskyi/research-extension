import { useEffect, useState } from "react";

import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";

import { pageNoticeResponseSchemas } from "../../schemas";

/** The options page's connection to the background, shared with the rest of the page. */
export interface PageNoticeClient {
  send: (message: RpcMessage<string, unknown>) => void;
  subscribe: (listener: (message: unknown) => void) => () => void;
}

const responseSchemas = { ...pageNoticeResponseSchemas, ...rpcResponseSchemas } as const;

/**
 * The switch for the notice a page shows when it was taken into research. The
 * background owns the setting; this shows what it said and asks to change it.
 */
export function PageNoticeToggle({ client }: { client: PageNoticeClient }) {
  const [isEnabled, setIsEnabled] = useState<boolean>();

  useEffect(() => {
    const unsubscribe = client.subscribe((message) => {
      let response;

      try {
        response = parseRpcMessage(message, responseSchemas);
      } catch (error) {
        if (error instanceof RpcMessageError) {
          return;
        }

        throw error;
      }

      if (response.type === "pageNotice.status") {
        setIsEnabled(response.payload.isEnabled);
      }
    });

    client.send(buildRpcMessage("pageNotice.read", {}));

    return unsubscribe;
  }, [client]);

  if (isEnabled === undefined) {
    return null;
  }

  return (
    <section data-testid="page-notice-card" className="mt-6">
      <h2 className="text-base font-semibold">Notice on pages</h2>
      <label className="mt-2 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          data-testid="page-notice-toggle"
          className="mt-1"
          checked={isEnabled}
          onChange={(event) => {
            client.send(buildRpcMessage("pageNotice.set", { isEnabled: event.target.checked }));
          }}
        />
        <span>
          Show a short notice in the corner of a page when it is added to research.
          <span className="block text-slate-600 dark:text-slate-300">
            It takes no clicks and goes away on its own.
          </span>
        </span>
      </label>
    </section>
  );
}
