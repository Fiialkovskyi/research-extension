import { useEffect, useState } from "react";

import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { Button } from "@/shared/ui";

import { parseBlockedSite } from "../../model/parseBlockedSite";
import { siteDenylistResponseSchemas } from "../../schemas";

/** The options page's connection to the background, shared with the rest of the page. */
export interface BlockedSitesClient {
  send: (message: RpcMessage<string, unknown>) => void;
  subscribe: (listener: (message: unknown) => void) => () => void;
}

const responseSchemas = { ...siteDenylistResponseSchemas, ...rpcResponseSchemas } as const;

const INVALID_HINT = "Enter a site such as example.org, or paste a link to it.";

/**
 * The sites the user keeps out of every session (REQ-SEC-007), on top of the
 * bundled list: add one by host or link, remove one.
 */
export function BlockedSitesCard({ client }: { client: BlockedSitesClient }) {
  const [sites, setSites] = useState<readonly string[]>();
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<string>();

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

      if (response.type === "denylist.view") {
        setSites(response.payload.sites);
        setHint(response.payload.invalid === undefined ? undefined : INVALID_HINT);
      }
    });

    client.send(buildRpcMessage("denylist.read", {}));

    return unsubscribe;
  }, [client]);

  if (sites === undefined) {
    return null;
  }

  const save = (next: readonly string[]) => {
    client.send(buildRpcMessage("denylist.save", { sites: [...next] }));
  };

  const add = () => {
    const site = parseBlockedSite(draft);

    if (site === undefined) {
      setHint(INVALID_HINT);
      return;
    }

    setDraft("");
    setHint(undefined);
    save([...sites, site]);
  };

  return (
    <section data-testid="blocked-sites" className="mt-6">
      <h2 className="text-sm font-medium">Sites never recorded</h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Banks, health, government, webmail and password managers are never recorded. Add your own
        sites here; their subdomains are left out too.
      </p>
      {sites.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {sites.map((site) => (
            <li key={site} data-testid="blocked-site" className="flex items-center gap-2">
              <span>{site}</span>
              <Button
                aria-label={`Remove ${site}`}
                onClick={() => {
                  save(sites.filter((other) => other !== site));
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label className="sr-only" htmlFor="blocked-site-input">
          Site to leave out
        </label>
        <input
          id="blocked-site-input"
          data-testid="blocked-site-input"
          className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-800"
          placeholder="example.org"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <Button data-testid="blocked-site-add" onClick={add}>
          Add
        </Button>
      </form>
      {hint !== undefined && (
        <p data-testid="blocked-site-hint" role="alert" className="mt-1 text-xs">
          {hint}
        </p>
      )}
    </section>
  );
}
