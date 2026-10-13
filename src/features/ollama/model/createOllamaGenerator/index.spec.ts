import { describe, expect, it, vi } from "vitest";

import { createOllamaGenerator } from ".";
import type { ModelManifest } from "@/shared/modelManifest";

const ORIGIN = "http://127.0.0.1:11434";
const DIGEST = "a".repeat(64);

const MANIFEST: ModelManifest = {
  manifestVersion: 1,
  reference: { hub: "ollama", repository: "qwen3:4b", revision: DIGEST },
  format: "local-server",
  files: [],
  license: "Apache License",
  contract: {
    family: "text-generation",
    contextWindow: 40960,
    maxNewTokens: 2048,
    chatTemplate: "server",
    structuredOutput: "json_schema",
  },
};

const encoder = new TextEncoder();

/**
 * A fake Ollama whose `/api/chat` streams `lines`, then closes — or, with
 * `isOpen`, stays open until the request's signal aborts it, as a real
 * connection does.
 */
const createServer = ({
  lines = [] as unknown[],
  isOpen = false,
  chatStatus = 200,
  chatBody = undefined as string | undefined,
} = {}) => {
  const chats: { body: Record<string, unknown>; signal: AbortSignal | undefined }[] = [];
  const fetchResource = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/api/tags")) {
      return Promise.resolve(
        new Response(JSON.stringify({ models: [{ name: "qwen3:4b", digest: DIGEST, size: 1 }] })),
      );
    }

    if (url.endsWith("/api/show")) {
      return Promise.resolve(new Response('{"error":"model is required"}', { status: 400 }));
    }

    const signal = init?.signal ?? undefined;

    chats.push({ body: JSON.parse(String(init?.body)) as Record<string, unknown>, signal });

    if (chatStatus !== 200) {
      return Promise.resolve(new Response(chatBody ?? "{}", { status: chatStatus }));
    }

    const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        for (const line of lines) {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        }

        if (isOpen) {
          signal?.addEventListener("abort", () => {
            controller.error(new DOMException("The operation was aborted.", "AbortError"));
          });
        } else {
          controller.close();
        }
      },
    });

    return Promise.resolve(new Response(body));
  });

  return { fetchResource, chats };
};

const piece = (content: string) => ({ message: { role: "assistant", content }, done: false });
const finish = (reason: string) => ({ message: { content: "" }, done: true, done_reason: reason });
const ASK = { messages: [{ role: "user" as const, content: "Say hello" }], maxTokens: 64 };

describe("createOllamaGenerator", () => {
  it("streams the answer piece by piece and gives the whole of it at the end", async () => {
    const server = createServer({ lines: [piece("Hel"), piece("lo"), finish("stop")] });
    const stream = createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST).generate(ASK);
    const pieces: string[] = [];

    for await (const { delta } of stream) {
      pieces.push(delta);
    }

    expect(pieces).toEqual(["Hel", "lo"]);
    await expect(stream.final()).resolves.toEqual({
      text: "Hello",
      device: "local-server",
      stoppedBecause: "model",
    });
  });

  it("asks for a bounded answer without the model's reasoning, in the schema when given one", async () => {
    const server = createServer({ lines: [finish("stop")] });
    const schema = { type: "object", properties: { name: { type: "string" } } };

    await createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST)
      .generate({ ...ASK, temperature: 0, responseSchema: schema })
      .final();

    expect(server.chats[0]?.body).toEqual({
      model: "qwen3:4b",
      messages: ASK.messages,
      stream: true,
      think: false,
      options: { num_predict: 64, temperature: 0 },
      format: schema,
    });
  });

  it("asks for the context the caller needs, and leaves Ollama's own otherwise", async () => {
    const server = createServer({ lines: [finish("stop"), finish("stop")] });
    const generator = createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST);

    await generator.generate({ ...ASK, contextTokens: 4_096 }).final();
    await generator.generate(ASK).final();

    expect(server.chats[0]?.body).toMatchObject({ options: { num_predict: 64, num_ctx: 4_096 } });
    expect(server.chats[1]?.body).toMatchObject({ options: { num_predict: 64 } });
    expect(server.chats[1]?.body).not.toHaveProperty("options.num_ctx");
  });

  it("says it stopped at the token limit when Ollama did", async () => {
    const server = createServer({ lines: [piece("1, 2, 3"), finish("length")] });

    await expect(
      createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST).generate(ASK).final(),
    ).resolves.toMatchObject({ stoppedBecause: "token-limit", text: "1, 2, 3" });
  });

  it("stops when cancelled, marked cancelled rather than complete, and closes the connection", async () => {
    const server = createServer({ lines: [piece("1, 2")], isOpen: true });
    const controller = new AbortController();
    const stream = createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST).generate({
      ...ASK,
      signal: controller.signal,
    });

    for await (const { delta } of stream) {
      expect(delta).toBe("1, 2");
      controller.abort();
    }

    await expect(stream.final()).resolves.toEqual({
      text: "1, 2",
      device: "local-server",
      stoppedBecause: "cancelled",
    });
    expect(server.chats[0]?.signal?.aborted).toBe(true);
  });

  it("does not ask at all when cancelled before it starts", async () => {
    const server = createServer();
    const controller = new AbortController();

    controller.abort();

    await expect(
      createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST)
        .generate({ ...ASK, signal: controller.signal })
        .final(),
    ).resolves.toMatchObject({ stoppedBecause: "cancelled", text: "" });
    expect(server.fetchResource).not.toHaveBeenCalled();
  });

  it("passes on an error Ollama reports mid-answer", async () => {
    const server = createServer({ lines: [piece("x"), { error: "out of memory" }] });

    await expect(
      createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST).generate(ASK).final(),
    ).rejects.toThrow("Ollama could not generate: out of memory");
  });

  it("fails an answer that ends without Ollama saying it finished", async () => {
    const server = createServer({ lines: [piece("x")] });
    const stream = createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST).generate(ASK);

    await expect(stream.final()).rejects.toThrow("before it finished");
  });

  it("says what Ollama answered when it will not generate", async () => {
    const server = createServer({
      chatStatus: 400,
      chatBody: '{"error":"invalid format"}',
    });

    await expect(
      createOllamaGenerator(server.fetchResource, ORIGIN, MANIFEST).generate(ASK).final(),
    ).rejects.toThrow("(HTTP 400): invalid format");
  });

  it("refuses to generate with a model that is not a generation model served by Ollama", () => {
    const embedding = {
      ...MANIFEST,
      contract: {
        family: "embedding",
        dimensions: 3,
        maxInputTokens: 512,
        pooling: "mean",
        normalize: true,
        similarity: "cosine",
        prefixes: { query: "", document: "" },
      },
    } as const satisfies ModelManifest;

    expect(() => createOllamaGenerator(vi.fn(), ORIGIN, embedding)).toThrow(
      "not a generation model",
    );
  });
});
