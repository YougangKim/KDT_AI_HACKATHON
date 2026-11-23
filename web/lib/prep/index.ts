// 신청 준비: 공고(이미 가진 데이터)와 인터뷰 답을 조합해 준비물·확인할 점·작성 초안을 만든다.
// AI가 없거나 실패해도 규칙만으로 체크리스트와 기본 초안을 낸다.
import type { AnswerRecord, Domain, Match } from "@/lib/types";

export interface PrepDraft { title: string; body: string }
export interface PrepPlan {
  fit: string[]; // 내 답과 맞는 점
  check: string[]; // 확인해야 할 점
  docs: string[]; // 준비 서류
  steps: string[]; // 신청 순서
  drafts: PrepDraft[]; // 대신 작성한 초안
  ai: boolean;
}

const BASE_DOCS: Record<Domain, string[]> = {
  job: ["이력서", "자기소개서", "최종학력 졸업(예정)증명서", "자격증·어학 성적 사본(해당 시)"],
  parttime: ["이력서(간단)", "신분증", "통장 사본(급여 수령용)"],
  housing: ["주민등록등본", "가족관계증명서", "소득 증빙(건강보험료 납부확인서 등)", "무주택 확인 서류"],
  benefit: ["신분증", "통장 사본", "소득 증빙(건강보험료 납부확인서 등)", "주민등록등본"],
  training: ["국민내일배움카드(발급 여부 확인)", "신분증", "고용보험 가입 이력(해당 시)"],
  exam: ["응시원서", "증명사진", "응시 자격 증빙(학력·경력 등)", "응시 수수료 결제 수단"],
};

/** 공고 요약·조건 문구에서 서류 이름을 뽑는다 */
function docsFromText(text: string): string[] {
  const found = text.match(/[가-힣·]{2,14}\s?(증명서|확인서|사본|등본|초본|원서|계획서|포트폴리오)/g) ?? [];
  return [...new Set(found)];
}

export function ruleBasedPlan(m: Match, answers: AnswerRecord[], now = new Date()): PrepPlan {
  const o = m.opportunity;
  const text = [o.summary, ...o.conditions.map((c) => c.rawText)].join(" ");
  const docs = [...new Set([...docsFromText(text), ...BASE_DOCS[o.domain]])].slice(0, 8);
  const end = o.applyEnd ? new Date(o.applyEnd) : null;
  const days = end ? Math.ceil((end.getTime() - now.getTime()) / 864e5) : null;
  const steps = [
    "원문 공고에서 자격 요건과 제출 서류를 한 번 더 확인합니다",
    `서류 준비${days !== null && days > 3 ? `(마감 ${days}일 전까지 여유 있게)` : ""}`,
    o.apply?.where ? `${o.apply.where}에서 ${o.apply.how || "신청"}` : `${o.apply?.how || "원문 안내에 따라 신청"}`,
    end ? `마감 ${o.applyEnd!.slice(0, 10)} 전에 접수 완료를 확인합니다` : "상시 접수: 예산 소진 시 조기 마감될 수 있어 빨리 신청합니다",
  ];
  const yes = answers.filter((a) => a.answer === "yes").map((a) => a.question.text.split(" — ")[0]).slice(0, 6);
  const drafts: PrepDraft[] = o.domain === "job" || o.domain === "parttime"
    ? [{ title: "지원 동기(초안)", body: `${o.org}의 「${o.title}」 공고를 보고 지원합니다. 공고에서 요구하는 역할에 관심이 있으며, 제 상황(${yes.slice(0, 3).join(", ") || "인터뷰 답변"})과 잘 맞는다고 판단했습니다. 입사 후에는 맡은 업무를 빠르게 익혀 기여하겠습니다. [구체적인 경험 1~2가지를 덧붙여 주세요]` }]
    : [{ title: "신청 사유(초안)", body: `「${o.title}」 지원 대상에 해당되어 신청합니다. 현재 ${yes.slice(0, 3).join(", ") || "인터뷰에서 답한 상황"}이며, 이 지원으로 생활 안정에 도움을 받고자 합니다. [구체적인 사정 1~2줄을 덧붙여 주세요]` }];
  return {
    fit: m.reasons.slice(0, 5),
    check: m.unknowns.map((c) => c.rawText).slice(0, 5),
    docs,
    steps,
    drafts,
    ai: false,
  };
}
