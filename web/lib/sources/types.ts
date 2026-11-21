import type { Domain, Opportunity } from "../types";

/** 공급원 어댑터: env 키가 있으면 실제 API를 호출해 Opportunity로 매핑 */
export interface SourceAdapter {
  id: string; // Opportunity.source 값
  domains: Domain[];
  envKey: string; // 필요한 환경변수명
  fetch(now: Date): Promise<Opportunity[]>;
}
