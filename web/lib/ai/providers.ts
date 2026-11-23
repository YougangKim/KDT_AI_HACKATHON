type ProviderName =
  | "groq"
  | "openrouter"
  | "cloudflare"
  | "gemini"
  | "anthropic";

interface ProviderStats {
  success: number;
  failure: number;
  cooldownUntil: number;
  promptTokens: number;
  completionTokens: number;
}

const names: ProviderName[] = [
  "groq",
  "openrouter",
  "cloudflare",
  "gemini",
  "anthropic",
];
const stats = Object.fromEntries(
  names.map((name) => [name, { success: 0, failure: 0, cooldownUntil: 0, promptTokens: 0, completionTokens: 0 }]),
) as Record<ProviderName, ProviderStats>;

const DEFAULT_COOLDOWN_MS = 10 * 60_000;

function retryAfter(response: Response): number {
  const value = response.headers.get("retry-after");
  if (!value) return DEFAULT_COOLDOWN_MS;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = new Date(value).getTime();
  return Number.isFinite(date)
    ? Math.max(0, date - Date.now())
    : DEFAULT_COOLDOWN_MS;
}

function shouldCooldown(status: number): boolean {
  return status === 402 || status === 429 || status >= 500;
}

async function request(
  name: ProviderName,
  url: string,
  init: RequestInit,
): Promise<Response | null> {
  if (stats[name].cooldownUntil > Date.now()) return null;
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      stats[name].failure++;
      if (shouldCooldown(response.status)) {
        stats[name].cooldownUntil =
          Date.now() +
          (response.status === 429 ? retryAfter(response) : DEFAULT_COOLDOWN_MS);
      }
      return null;
    }
    return response;
  } catch {
    stats[name].failure++;
    return null;
  }
}

async function openAiCompatible(
  name: ProviderName,
  url: string,
  token: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  extraHeaders: Record<string, string> = {},
): Promise<string | null> {
  const response = await request(name, url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
      ...(name === "groq" && model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" } : {}),
    }),
  });
  if (!response) return null;
  try {
    const body = await response.json() as {
      choices?: { message?: { content?: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };
    stats[name].promptTokens += body.usage?.prompt_tokens ?? 0;
    stats[name].completionTokens += body.usage?.completion_tokens ?? 0;
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      stats[name].failure++;
      return null;
    }
    stats[name].success++;
    return text;
  } catch {
    stats[name].failure++;
    return null;
  }
}

export async function askGemini(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const response = await request(
    "gemini",
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.2,
        },
      }),
    },
  );
  if (!response) return null;
  try {
    const body = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };
    stats.gemini.promptTokens += body.usageMetadata?.promptTokenCount ?? 0;
    stats.gemini.completionTokens += body.usageMetadata?.candidatesTokenCount ?? 0;
    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      stats.gemini.failure++;
      return null;
    }
    stats.gemini.success++;
    return text;
  } catch {
    stats.gemini.failure++;
    return null;
  }
}

async function askAnthropic(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const response = await request(
    "anthropic",
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: maxTokens,
      }),
    },
  );
  if (!response) return null;
  try {
    const body = await response.json() as {
      content?: { type?: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };
    stats.anthropic.promptTokens += body.usage?.input_tokens ?? 0;
    stats.anthropic.completionTokens += body.usage?.output_tokens ?? 0;
    const text = (body.content ?? [])
      .map((block) => block.type === "text" ? block.text ?? "" : "")
      .join("")
      .trim();
    if (!text) {
      stats.anthropic.failure++;
      return null;
    }
    stats.anthropic.success++;
    return text;
  } catch {
    stats.anthropic.failure++;
    return null;
  }
}

export async function chat(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  const attempts: (() => Promise<string | null>)[] = [];

  if (process.env.GROQ_API_KEY) {
    attempts.push(() => openAiCompatible(
      "groq",
      "https://api.groq.com/openai/v1/chat/completions",
      process.env.GROQ_API_KEY!,
      process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      system,
      user,
      maxTokens,
    ));
  }
  if (process.env.OPENROUTER_API_KEY) {
    attempts.push(() => openAiCompatible(
      "openrouter",
      "https://openrouter.ai/api/v1/chat/completions",
      process.env.OPENROUTER_API_KEY!,
      process.env.OPENROUTER_MODEL ||
        "meta-llama/llama-3.3-70b-instruct:free",
      system,
      user,
      maxTokens,
    ));
  }
  if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
    attempts.push(() => openAiCompatible(
      "cloudflare",
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`,
      process.env.CF_API_TOKEN!,
      process.env.CF_MODEL || "@cf/meta/llama-3.1-8b-instruct",
      system,
      user,
      maxTokens,
    ));
  }
  if (process.env.GEMINI_API_KEY) {
    attempts.push(() => askGemini(system, user, maxTokens));
  }
  if (process.env.ANTHROPIC_API_KEY) {
    attempts.push(() => askAnthropic(system, user, maxTokens));
  }

  for (const attempt of attempts) {
    const result = await attempt();
    if (result) return result;
  }
  return null;
}

export function aiProviderStatus() {
  const now = Date.now();
  return Object.fromEntries(names.map((name) => [
    name,
    {
      success: stats[name].success,
      failure: stats[name].failure,
      cooldownRemainingMs: Math.max(0, stats[name].cooldownUntil - now),
      promptTokens: stats[name].promptTokens,
      completionTokens: stats[name].completionTokens,
      totalTokens: stats[name].promptTokens + stats[name].completionTokens,
    },
  ]));
}

export function _resetProviders(): void {
  for (const name of names) {
    stats[name] = {
      success: 0,
      failure: 0,
      cooldownUntil: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
  }
}
