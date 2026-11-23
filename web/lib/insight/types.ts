// 리서치 인사이트 공통 타입 (통합 스레드 소유)
import type { AnswerRecord, AttrKey, Domain } from "@/lib/types";

/** 사용자가 화면에서 답한 질문 하나가 후보를 얼마나 걸러 냈는지 */
export interface FilterStep {
  questionId: string;
  relatedAnswerIds: string[];
  question: string;
  answerLabel: string;
  reason: string;
  label: string;
  attr: AttrKey;
  answer: AnswerRecord;
  /** 이전 질문 단계에서 실제로 제외된 수 */
  removedCount: number;
  /** 이전 컴포넌트 호환용. removedCount와 같다. */
  aloneRemoved: number;
  removedIds: string[];
  examples: string[];
  passedWithout: number;
  hard: boolean;
}

export interface PendingQuestion {
  question: string;
  attr: AttrKey;
}

export interface Relaxation {
  step: FilterStep;
  gain: number; // 이 조건을 풀면 늘어나는 통과 수 (passedWithout - passed)
  suggestion: string; // 화면 문구 (예: "소득 조건을 '모름'으로 두면 12건이 더 표시됩니다")
}

export interface FunnelReport {
  total: number; // 조사한 전체 공고 수
  passed: number; // 모든 답변을 통과한 수(eligible + needs_check)
  passRate: number; // passed / total (0~1)
  byDomain: Record<Domain, { total: number; passed: number }>;
  steps: FilterStep[]; // 사용자가 답한 질문 순서
  bottleneck: Relaxation | null; // hard 아닌 조건 중 gain 최대(0이면 null)
  /** 풀면 결과가 늘어나는 조건들(최대 3개). 바꾸기 어려운 지역 조건은 뒤로 */
  relaxOptions: Relaxation[];
  pendingCount: number;
  pendingQuestions: PendingQuestion[];
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
