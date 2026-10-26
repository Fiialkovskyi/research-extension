// @vitest-environment node
// Timed: jsdom's globals slow typed-array arithmetic about fivefold, which says
// nothing about the browser; nothing here needs a DOM.
import { describe, expect, it } from "vitest";

import { clusterSession } from ".";
import type { EdgeKind, StoredEdge, StoredNode } from "@/shared/storage";

/** A page read for a while, so not a dead end. */
const READ = {
  activeDwellMs: 20_000,
  maxScroll: 0.5,
  copyEvents: 0,
  pasteEvents: 0,
  focusCount: 1,
  revisitCount: 0,
  quickReturnCount: 0,
};

/** A page left at a glance. */
const GLANCED = { ...READ, activeDwellMs: 2_000, maxScroll: 0 };

let clock = 0;

const page = (id: string, overrides: Partial<StoredNode> = {}): StoredNode => ({
  id,
  sessionId: "session-1",
  tabId: 1,
  kind: "page",
  url: `https://example.org/${id}`,
  domain: "example.org",
  title: `Page ${id}`,
  parentNodeId: null,
  openerNodeId: null,
  transitionType: "link",
  signals: READ,
  tabState: "open",
  createdAt: (clock += 1),
  ...overrides,
});

const search = (id: string, query: string) => page(id, { kind: "serp", query });

const edge = (from: string, to: string, kind: EdgeKind = "opener", weight = 1): StoredEdge => ({
  id: `${from}|${to}|${kind}`,
  sessionId: "session-1",
  kind,
  from,
  to,
  weight,
  createdAt: 0,
});

const ids = () => {
  let next = 0;

  return () => `cluster-${(next += 1)}`;
};

const cluster = (nodes: StoredNode[], edges: StoredEdge[], previous = [] as never[]) =>
  clusterSession({ sessionId: "session-1", nodes, edges, previous, now: 99, createId: ids() });

/** Which pages share a cluster, as sorted groups of ids. */
const readGroups = (result: ReturnType<typeof clusterSession>) =>
  result.clusters.map(({ memberIds }) => memberIds.toSorted()).toSorted();

/** Two searches, each with two results opened from it. */
const twoThreads = () => {
  const nodes = [
    search("s1", "e-bike motors"),
    page("a", { openerNodeId: "s1" }),
    page("b", { openerNodeId: "s1" }),
    search("s2", "battery range"),
    page("c", { openerNodeId: "s2" }),
    page("d", { openerNodeId: "s2" }),
  ];
  const edges = [edge("s1", "a"), edge("s1", "b"), edge("s2", "c"), edge("s2", "d")];

  return { nodes, edges };
};

/** A unit vector pointing along axis `axis` of 384. */
const axisVector = (axis: number) => {
  const vector = new Float32Array(384);

  vector[axis] = 1;

  return vector;
};

const entity = (name: string, factCount: number, ...nodeIds: string[]) => ({
  name,
  factCount,
  pages: nodeIds.map((nodeId) => ({ nodeId, factCount: 2 })),
});

const withEntities = (
  nodes: StoredNode[],
  entities: ReturnType<typeof entity>[],
): ReturnType<typeof clusterSession> =>
  clusterSession({
    sessionId: "session-1",
    nodes,
    edges: [],
    previous: [],
    now: 99,
    createId: ids(),
    entities,
  });

describe("clusterSession", () => {
  it("separates two threads of research", () => {
    const { nodes, edges } = twoThreads();

    expect(readGroups(cluster(nodes, edges))).toEqual([
      ["a", "b", "s1"],
      ["c", "d", "s2"],
    ]);
  });

  it("puts pages compared side by side together", () => {
    expect(
      readGroups(cluster([page("a"), page("b")], [edge("a", "b", "coAttention", 0.8)])),
    ).toEqual([["a", "b"]]);
  });

  it("puts a dead end in the cluster of the page it was reached from", () => {
    const { nodes, edges } = twoThreads();
    const result = cluster(
      [...nodes, page("p", { openerNodeId: "s1", signals: GLANCED })],
      [...edges, edge("s1", "p")],
    );

    expect(readGroups(result)).toEqual([
      ["a", "b", "p", "s1"],
      ["c", "d", "s2"],
    ]);
  });

  it("follows a chain of dead ends to the first page that has a cluster", () => {
    const result = cluster(
      [
        page("a"),
        page("b"),
        page("p", { parentNodeId: "a", signals: GLANCED }),
        page("q", { parentNodeId: "p", signals: GLANCED }),
      ],
      [edge("a", "b")],
    );

    expect(readGroups(result)).toEqual([["a", "b", "p", "q"]]);
  });

  it("leaves a dead end with no clustered source, and a page with no relation, on their own", () => {
    const result = cluster(
      [page("a"), page("b"), page("lone"), page("p", { signals: GLANCED })],
      [edge("a", "b")],
    );

    expect(readGroups(result)).toEqual([["a", "b"], ["lone"], ["p"]]);
  });

  it("gives the same clusters for the same graph", () => {
    const { nodes, edges } = twoThreads();

    expect(cluster(nodes, edges)).toEqual(cluster(nodes, edges));
    expect(cluster(nodes.toReversed(), edges.toReversed())).toEqual(cluster(nodes, edges));
  });

  it("names a cluster by its earliest search, or its earliest page", () => {
    const { nodes, edges } = twoThreads();
    const labels = cluster([...nodes, page("lone", { title: "Spokes" })], edges).clusters.map(
      ({ label }) => label,
    );

    expect(labels).toEqual(["e-bike motors", "battery range", "Spokes"]);
  });

  it("records which algorithm and configuration produced it, and when", () => {
    const { nodes, edges } = twoThreads();

    expect(cluster(nodes, edges)).toMatchObject({
      sessionId: "session-1",
      algorithmVersion: "louvain@1",
      configVersion: "cluster_config@1",
      computedAt: 99,
    });
  });

  it("keeps a cluster's id when a page joins its thread", () => {
    const { nodes, edges } = twoThreads();
    const first = cluster(nodes, edges);
    const again = clusterSession({
      sessionId: "session-1",
      nodes: [...nodes, page("e", { parentNodeId: "b" })],
      edges: [...edges, edge("b", "e", "sameTab", 0.5)],
      previous: first.clusters,
      now: 100,
      createId: () => "fresh",
    });
    const before = first.clusters.find(({ memberIds }) => memberIds.includes("s1"));
    const after = again.clusters.find(({ memberIds }) => memberIds.includes("s1"));

    expect(after?.memberIds.toSorted()).toEqual(["a", "b", "e", "s1"]);
    expect(after?.id).toBe(before?.id);
  });

  describe("entities", () => {
    it("puts pages that state facts about one entity together", () => {
      const nodes = [page("a"), page("b"), page("c")];

      expect(readGroups(withEntities(nodes, [entity("Pixel 10a", 6, "a", "c")]))).toEqual([
        ["a", "c"],
        ["b"],
      ]);
    });

    it("does not join pages through an entity with too few facts", () => {
      const nodes = [page("a"), page("b")];

      expect(readGroups(withEntities(nodes, [entity("Pixel 10a", 2, "a", "b")]))).toEqual([
        ["a"],
        ["b"],
      ]);
    });

    it("names the cluster after its entity", () => {
      const nodes = [page("a"), page("b")];
      const result = withEntities(nodes, [entity("Pixel 10a", 6, "a", "b")]);

      expect(result.clusters.map(({ label }) => label)).toEqual(["Pixel 10a"]);
    });

    it("clusters as before without entities", () => {
      const nodes = [page("a"), page("b")];

      expect(readGroups(withEntities(nodes, []))).toEqual([["a"], ["b"]]);
    });
  });

  it("clusters 300 pages well within 200 ms", () => {
    const nodes: StoredNode[] = [];
    const edges: StoredEdge[] = [];

    for (let thread = 0; thread < 30; thread += 1) {
      const root = `s${thread}`;

      nodes.push(search(root, `query ${thread}`));

      for (let result = 0; result < 9; result += 1) {
        const id = `${root}-${result}`;

        nodes.push(page(id, { openerNodeId: root }));
        edges.push(edge(root, id));

        if (result > 0) {
          edges.push(edge(`${root}-${result - 1}`, id, "coAttention", 0.8));
        }
      }

      if (thread > 0) {
        edges.push(edge(`s${thread - 1}`, root, "refinement", 0.3));
      }
    }

    const durations = Array.from({ length: 10 }, () => {
      const started = performance.now();

      cluster(nodes, edges);

      return performance.now() - started;
    }).toSorted((first, second) => first - second);

    expect(nodes).toHaveLength(300);
    expect(durations[5]).toBeLessThan(200);
  });

  describe("with page vectors", () => {
    it("joins two pages with no recorded relation whose content is similar", () => {
      const result = clusterSession({
        sessionId: "session-1",
        nodes: [page("a"), page("b"), page("other")],
        edges: [],
        previous: [],
        now: 1,
        createId: ids(),
        semantic: {
          spaceId: "space-1",
          vectors: new Map([
            ["a", axisVector(0)],
            ["b", axisVector(0)],
            ["other", axisVector(5)],
          ]),
        },
      });

      expect(readGroups(result)).toEqual([["a", "b"], ["other"]]);
      expect(result.embeddingSpaceId).toBe("space-1");
    });

    it("strengthens a thread with similar content without rewriting the structure", () => {
      const { nodes, edges } = twoThreads();
      const vectors = new Map([
        ["a", axisVector(0)],
        ["b", axisVector(0)],
        ["c", axisVector(9)],
        ["d", axisVector(9)],
      ]);
      const result = clusterSession({
        sessionId: "session-1",
        nodes,
        edges,
        previous: [],
        now: 1,
        createId: ids(),
        semantic: { spaceId: "space-1", vectors },
      });

      expect(readGroups(result)).toEqual([
        ["a", "b", "s1"],
        ["c", "d", "s2"],
      ]);
    });

    it("keeps a dead end out of detection, whatever its vector", () => {
      const result = clusterSession({
        sessionId: "session-1",
        nodes: [page("a"), page("b"), page("p", { parentNodeId: "a", signals: GLANCED })],
        edges: [edge("a", "b")],
        previous: [],
        now: 1,
        createId: ids(),
        semantic: {
          spaceId: "space-1",
          vectors: new Map([
            ["a", axisVector(1)],
            ["p", axisVector(1)],
          ]),
        },
      });

      expect(readGroups(result)).toEqual([["a", "b", "p"]]);
    });

    it("records no space when no page has a vector", () => {
      const { nodes, edges } = twoThreads();
      const result = clusterSession({
        sessionId: "session-1",
        nodes,
        edges,
        previous: [],
        now: 1,
        semantic: { spaceId: "space-1", vectors: new Map() },
      });

      expect(result).not.toHaveProperty("embeddingSpaceId");
    });

    it("clusters 300 pages with 384-dimension vectors well within 200 ms", () => {
      const nodes = Array.from({ length: 300 }, (_, index) => page(`p${index}`));
      const vectors = new Map(
        nodes.map((node, index) => {
          const vector = new Float32Array(384);

          vector[index % 12] = 1;
          vector[(index * 7) % 384] = (vector[(index * 7) % 384] ?? 0) + 0.5;

          return [node.id, vector];
        }),
      );
      const durations = Array.from({ length: 5 }, () => {
        const started = performance.now();

        clusterSession({
          sessionId: "session-1",
          nodes,
          edges: [],
          previous: [],
          now: 1,
          semantic: { spaceId: "space-1", vectors },
        });

        return performance.now() - started;
      }).toSorted((first, second) => first - second);

      expect(durations[2]).toBeLessThan(200);
    });
  });
});
