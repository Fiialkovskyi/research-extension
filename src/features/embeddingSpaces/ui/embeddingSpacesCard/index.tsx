import { useEffect, useState } from "react";

import {
  buildRpcMessage,
  parseRpcMessage,
  type RpcMessage,
  RpcMessageError,
  rpcResponseSchemas,
} from "@/shared/rpc";
import { Button } from "@/shared/ui";

import { embeddingSpaceResponseSchemas } from "../../schemas";
import type { SpaceUsage } from "../../types";

/** The options page's connection to the background, shared with the rest of the page. */
export interface EmbeddingSpacesClient {
  send: (message: RpcMessage<string, unknown>) => void;
  subscribe: (listener: (message: unknown) => void) => () => void;
}

const responseSchemas = { ...embeddingSpaceResponseSchemas, ...rpcResponseSchemas } as const;

/** Writes a byte count as KB or MB. */
const formatBytes = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const formatDate = (epochMs: number): string => new Date(epochMs).toLocaleDateString();

/** Says what a space is doing: in use, retired since a date, or removed. */
const describeState = (space: SpaceUsage): string => {
  if (space.removedAt !== null) {
    return `removed ${formatDate(space.removedAt)}`;
  }

  if (space.inUse) {
    return "in use";
  }

  return space.retiredAt === null
    ? "not in use"
    : `retired ${formatDate(space.retiredAt)}, kept 14 days`;
};

/**
 * Every embedding space with its disk use (REQ-LIN-004), and "Remove" for one
 * no session uses. A model swap retires a space; it keeps its vectors 14 days.
 */
export function EmbeddingSpacesCard({ client }: { client: EmbeddingSpacesClient }) {
  const [spaces, setSpaces] = useState<readonly SpaceUsage[]>();

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

      if (response.type === "spaces.listed") {
        setSpaces(response.payload.spaces);
      } else if (response.type === "spaces.removed") {
        client.send(buildRpcMessage("spaces.list", {}));
      }
    });

    client.send(buildRpcMessage("spaces.list", {}));

    return unsubscribe;
  }, [client]);

  if (spaces === undefined) {
    return null;
  }

  return (
    <section data-testid="embedding-spaces" className="mt-6">
      <h2 className="text-sm font-medium">Embedding spaces</h2>
      {spaces.length === 0 ? (
        <p data-testid="spaces-none" className="mt-1 text-xs">
          No page has been embedded yet.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {spaces.map((space) => (
            <li key={space.id} data-testid="space" className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{space.repository}</span>
              <span>
                {space.vectorCount} vectors, {formatBytes(space.approximateBytes)} —{" "}
                {describeState(space)}
              </span>
              {!space.inUse && space.removedAt === null && (
                <Button
                  data-testid="space-remove"
                  onClick={() => {
                    client.send(buildRpcMessage("spaces.remove", { spaceId: space.id }));
                  }}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
