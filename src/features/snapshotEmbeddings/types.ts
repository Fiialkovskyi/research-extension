import type * as v from "valibot";

import type { embedSnapshotPayloadSchema } from "./schemas";

/** What an `embedSnapshot` job reads beyond its identity. */
export type EmbedSnapshotPayload = v.InferOutput<typeof embedSnapshotPayloadSchema>;
