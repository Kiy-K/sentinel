/**
 * LLM access via OpenRouter directly. Requires OPENROUTER_API_KEY in env.
 * Requests retry with backoff and fall back across a short list of models.
 */

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GatewayClient = {
  chatCompletion: (opts: {
    messages: ChatMessage[];
    maxTokens?: number;
    model?: string;
  }) => Promise<string>;
};

const DEFAULT_MODELS = ["deepseek/deepseek-v3.2"];

const TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createGatewayClient(opts: {
  fetchImpl?: FetchLike;
  baseUrl?: string;
  models?: string[];
  sleep?: SleepFn;
}): GatewayClient {
  const fetchImpl = opts.fetchImpl ?? ((globalThis.fetch as unknown) as FetchLike);
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl: string = opts.baseUrl ?? "https://openrouter.ai/api/v1/chat/completions";
  if (!opts.baseUrl && !apiKey) {
    throw new LlmUnavailableError("OPENROUTER_API_KEY is not set");
  }
  const fallbackModels = opts.models?.length ? opts.models : DEFAULT_MODELS;
  const sleep = opts.sleep ?? defaultSleep;

  async function chatCompletion({
    messages,
    maxTokens,
    model,
  }: {
    messages: ChatMessage[];
    maxTokens?: number;
    model?: string;
  }): Promise<string> {
    const models = model ? [model] : fallbackModels;
    let lastError = "no models configured";

    for (const m of models) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let res: Response;
        try {
          res = await fetchImpl(baseUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: m,
              messages,
              ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
        } catch (err) {
          // Network error or timeout: retry with backoff.
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt < MAX_ATTEMPTS - 1) {
            await sleep(backoff(attempt));
            continue;
          }
          break;
        }

        if (res.ok) {
          const body = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = body.choices?.[0]?.message?.content;
          if (typeof content === "string") return content;
          throw new LlmUnavailableError("gateway returned no choices[0].message.content");
        }

        const bodyText = await res.text().catch(() => "");
        if (res.status === 429 || res.status >= 500) {
          lastError = `HTTP ${res.status}: ${bodyText.slice(0, 500)}`;
          if (attempt < MAX_ATTEMPTS - 1) {
            await sleep(backoff(attempt));
            continue;
          }
          break;
        }
        // Permanent client error: fail fast with the body surfaced.
        throw new Error(`gateway error HTTP ${res.status}: ${bodyText.slice(0, 1000)}`);
      }
    }

    throw new LlmUnavailableError(`LLM unavailable after retries: ${lastError}`);
  }

  return { chatCompletion };
}

function backoff(attempt: number): number {
  const base = 500 * 2 ** attempt;
  return base + Math.floor(Math.random() * 250);
}

let defaultClient: GatewayClient | undefined;
function defaultClientLazy(): GatewayClient {
  if (!defaultClient) defaultClient = createGatewayClient({});
  return defaultClient;
}
export const chatCompletion: GatewayClient["chatCompletion"] = (args) =>
  defaultClientLazy().chatCompletion(args);
