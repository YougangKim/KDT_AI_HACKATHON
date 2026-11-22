// 리서치 인사이트 공통 타입 (통합 스레드 소유)
import type { AnswerRecord, AttrKey, Domain } from "@/lib/types";

/** 답변 하나(=필터 하나)가 후보를 얼마나 걸러 냈는지 */
export interface FilterStep {
  questionId: string;
  label: string; // 사람이 읽는 조건 문구 (예: "기준중위소득 150% 이하 → 아니오")
  attr: AttrKey;
  answer: AnswerRecord;
  /** 이 답변 하나만 적용했을 때 탈락하는 후보 수 */
  aloneRemoved: number;
  /** 이 답변만 빼고(모름 처리) 나머지 답변을 모두 적용했을 때 통과 수 */
  passedWithout: number;
  hard: boolean; // 사용자가 '타협 불가'로 표시한 조건
}

export interface Relaxation {
  step: FilterStep;
  gain: number; // 이 조건을 풀면 늘어나는 통과 수 (passedWithout - passed)
  suggestion: string; // 화면 문구 (예: "소득 조건을 '모름'으로 두면 12건이 더 보여요")
}

export interface FunnelReport {
  total: number; // 조사한 전체 공고 수
  passed: number; // 모든 답변을 통과한 수(eligible + needs_check)
  passRate: number; // passed / total (0~1)
  byDomain: Record<Domain, { total: number; passed: number }>;
  steps: FilterStep[]; // aloneRemoved 내림차순
  bottleneck: Relaxation | null; // hard 아닌 조건 중 gain 최대(0이면 null)
  scarce: boolean; // passed가 너무 적음(<= 3 또는 passRate < 5%)
}

/** 반복 조사 1회 기록(주간 리포트용) */
export interface ScanSnapshot {
  at: string;
  total: number;
  passed: number;
  newCount: number;
  byDomainNew: Partial<Record<Domain, number>>;
  failedSources: string[]; // 키 없음·오류로 샘플 폴백된 출처
  changedCount?: number; // 마감일이 바뀐 공고 수
  soonCount?: number; // 이번 조사에서 새로 D-3 이내가 된 공고 수
}
