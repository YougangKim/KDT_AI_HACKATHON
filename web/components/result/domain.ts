import type { Domain } from "@/lib/types";

export const DOMAIN_META: Record<Domain, { emoji: string; label: string; color: string }> = {
  housing: { emoji: "🏠", label: "주거", color: "#15803d" },
  job: { emoji: "💼", label: "채용", color: "#1d4ed8" },
  parttime: { emoji: "⏰", label: "알바·단기", color: "#c2410c" },
  benefit: { emoji: "💰", label: "지원금", color: "#7e22ce" },
  training: { emoji: "📚", label: "국비 과정", color: "#0f766e" },
  exam: { emoji: "📝", label: "자격증", color: "#475569" },
};
