import type { Domain } from "@/lib/types";
import type { IconName } from "@/components/brand/Icons";

export const DOMAIN_META: Record<Domain, { icon: IconName; label: string; color: string }> = {
  housing: { icon: "housing", label: "주거", color: "#15803d" },
  job: { icon: "job", label: "채용", color: "#1d4ed8" },
  parttime: { icon: "parttime", label: "알바·단기", color: "#c2410c" },
  benefit: { icon: "benefit", label: "지원금", color: "#7e22ce" },
  training: { icon: "training", label: "국비 과정", color: "#0f766e" },
  exam: { icon: "exam", label: "자격증", color: "#475569" },
};
