import { aiProviderStatus } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(aiProviderStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
