import { aiProviderStatus } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providers = aiProviderStatus();
  const total = Object.values(providers).reduce(
    (sum, provider) => ({
      promptTokens: sum.promptTokens + provider.promptTokens,
      completionTokens: sum.completionTokens + provider.completionTokens,
      totalTokens: sum.totalTokens + provider.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );
  return Response.json({ ...providers, usageTotal: total }, {
    headers: { "Cache-Control": "no-store" },
  });
}
