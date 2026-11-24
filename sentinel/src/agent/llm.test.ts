import { describe, expect, test } from "bun:test";
import {
  createGatewayClient,
  LlmUnavailableError,
  type ChatMessage,
} from "./llm";

const messages: ChatMessage[] = [{ role: "user", content: "hi" }];

const okResponse = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (status: number, body: string) =>
  new Response(body, { status });

const noSleep = () => Promise.resolve();

describe("createGatewayClient", () => {
  test("retries a 429 and then succeeds", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return calls === 1 ? errorResponse(429, "rate limited") : okResponse("fixed");
    };
    const client = createGatewayClient({
      fetchImpl,
      baseUrl: "https://gateway.test/v1",
      models: ["model-a"],
      sleep: noSleep,
    });
    const out = await client.chatCompletion({ messages });
    expect(out).toBe("fixed");
    expect(calls).toBe(2);
  });

  test("persistent 429 throws LlmUnavailableError after retries and fallbacks", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return errorResponse(429, "rate limited");
    };
    const client = createGatewayClient({
      fetchImpl,
      baseUrl: "https://gateway.test/v1",
      models: ["model-a", "model-b"],
      sleep: noSleep,
    });
    await expect(client.chatCompletion({ messages })).rejects.toBeInstanceOf(
      LlmUnavailableError,
    );
    expect(calls).toBe(6); // 3 attempts x 2 models
  });

  test("falls back to the next model after the first exhausts retries", async () => {
    const seenModels: string[] = [];
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const model = JSON.parse(String(init?.body)).model as string;
      seenModels.push(model);
      return model === "model-a" ? errorResponse(503, "down") : okResponse("fallback-ok");
    };
    const client = createGatewayClient({
      fetchImpl,
      baseUrl: "https://gateway.test/v1",
      models: ["model-a", "model-b"],
      sleep: noSleep,
    });
    const out = await client.chatCompletion({ messages });
    expect(out).toBe("fallback-ok");
    expect(seenModels).toEqual(["model-a", "model-a", "model-a", "model-b"]);
  });

  test("non-retryable error surfaces the response body and does not retry", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return errorResponse(400, "bad request: model nope");
    };
    const client = createGatewayClient({
      fetchImpl,
      baseUrl: "https://gateway.test/v1",
      models: ["model-a"],
      sleep: noSleep,
    });
    const err = await client.chatCompletion({ messages }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(LlmUnavailableError);
    expect(String(err.message)).toContain("HTTP 400");
    expect(String(err.message)).toContain("bad request: model nope");
    expect(calls).toBe(1);
  });

  test("extracts choices[0].message.content from a 200 response", async () => {
    const fetchImpl = async () => okResponse("the answer");
    const client = createGatewayClient({
      fetchImpl,
      baseUrl: "https://gateway.test/v1",
      models: ["model-a"],
      sleep: noSleep,
    });
    const out = await client.chatCompletion({ messages });
    expect(out).toBe("the answer");
  });
});
