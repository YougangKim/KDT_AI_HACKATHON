import type { Domain } from "@/lib/types";

export const DOMAIN_META: Record<Domain, { emoji: string; label: string }> = {
  housing: { emoji: "🏠", label: "청년 주택" },
  benefit: { emoji: "💰", label: "지원금·혜택" },
  job: { emoji: "💼", label: "채용·인턴" },
  parttime: { emoji: "⏰", label: "알바" },
  training: { emoji: "📚", label: "국비 과정" },
  exam: { emoji: "📝", label: "자격증 일정" },
};
