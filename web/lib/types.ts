// 공통 계약(모든 스레드가 공유). 변경은 통합 스레드만 한다. 필요하면 통합 스레드에 요청.

/** 기회 분야. 새 분야는 여기 추가 + 어댑터 + 샘플 JSON */
export type Domain =
  | "housing" // 청년 주택·임대
  | "job" // 구직·공공기관 채용·인턴
  | "parttime" // 알바
  | "benefit" // 청년정책·지원금·혜택
  | "training" // 국비과정(KDT 등)
  | "exam"; // 자격증 시험 일정

/** 사용자 상황 속성. 질문은 이 속성들에 대한 예/아니오로 만들어진다 */
export type AttrKey =
  | "age" // 만 나이(number)
  | "region" // 거주 시도(string, 예: "서울", "경기")
  | "homeless" // 무주택(boolean)
  | "livingAlone" // 1인 가구·독립(boolean)
  | "incomePct" // 기준중위소득 대비 %(number, 예: 100)
  | "employment" // "student" | "jobseeker" | "employed" | "parttime"
  | "interest"; // 관심 분야(Domain)

export type AttrValue = number | string | boolean;

export interface Condition {
  attr: AttrKey;
  op: "eq" | "lte" | "gte" | "in";
  value: AttrValue | AttrValue[];
  rawText: string; // 원문 자격요건 문장(근거 표시용)
  confidence: "high" | "low"; // AI 구조화 신뢰도. low면 결과에서 "확인 필요"
  aiGenerated?: boolean; // AI(Claude)가 원문에서 해석한 조건이면 true → 화면에 "AI 해석" 표시
}

export interface Opportunity {
  id: string; // `${source}:${원본ID}`
  domain: Domain;
  title: string;
  org: string; // 공고 기관
  region: string[]; // 대상 지역. 빈 배열 = 전국
  summary: string;
  conditions: Condition[];
  applyStart?: string; // ISO 날짜
  applyEnd?: string; // ISO 날짜. 없으면 상시
  url: string; // 원문 링크
  source: string; // 공급원 id (config/api_keys.csv의 API와 대응)
  isSample: boolean; // 키가 없어 샘플 데이터면 true (화면에 표시)
  origin?: "api" | "sample" | "websearch" | "rss"; // websearch = 선택 기능(Tavily·Exa) 결과. 화면에 "웹 검색 결과" 배지
  fetchedAt: string;
}

/** 사용자의 답. "unknown" = 모름 */
export type Answer = "yes" | "no" | "unknown";

/** 질문 하나 = 조건 하나에 대한 예/아니오 */
export interface Question {
  id: string; // `${attr}:${op}:${value}`
  attr: AttrKey;
  op: Condition["op"];
  value: Condition["value"];
  text: string; // 화면에 보일 문장(게임 말투)
}

export interface AnswerRecord {
  question: Question;
  answer: Answer;
}

/** 매칭 결과 */
export interface Match {
  opportunity: Opportunity;
  status: "eligible" | "needs_check"; // 모름·저신뢰 조건이 남으면 needs_check
  reasons: string[]; // 왜 맞는지(답변 근거)
  unknowns: Condition[]; // 확인 필요 조건
}

/** 알림 구독용 저장 프로필(브라우저 localStorage 키: "watch") */
export interface Watch {
  createdAt: string;
  answers: AnswerRecord[];
  domains: Domain[];
  seenIds: string[]; // 이미 본 공고 id. 새 공고 판정 기준
}
