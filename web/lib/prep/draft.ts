// 유형별 규칙 초안과 초안 품질 검사(규칙·AI 공통).
import type { AttrKey, Opportunity } from "@/lib/types";
import { companyIn, isSourceName, shortTitle, type PrepKind } from "./kind";
import { joinFacts, pickFacts, type Profile } from "./profile";

export interface PrepDraft { title: string; body: string; list?: boolean }

/** 유형별로 초안에 쓸 사실 우선순위 */
export const FACT_ORDER: Record<PrepKind, AttrKey[]> = {
  job: ["employment", "education", "experienced", "field"],
  job_event: ["employment", "field", "experienced"],
  parttime: ["employment"],
  benefit_cash: ["livingAlone", "incomePct", "employment", "welfare", "need"],
  benefit_service: ["employment", "need", "livingAlone"],
  housing_rent: ["homeless", "livingAlone", "incomePct", "subscription", "married"],
  housing_sale: ["homeless", "subscription", "married"],
  training: ["employment", "field", "education", "experienced"],
  exam: [],
};

/** 요약에서 혜택 금액 구절(예: "월 최대 20만 원") */
export function benefitPhrase(summary: string): string | undefined {
  return summary.match(/((월|연|1인당|최대|총)\s?)+[\d,.]+\s?(만\s?원|원|천\s?원)/)?.[0];
}

/** 초안이 필요 없는 유형의 안내 */
export const NO_DRAFT_NOTE: Partial<Record<PrepKind, string>> = {
  housing_rent: "임대주택 신청은 보통 자기소개서를 받지 않습니다. 필요한 경우에만 아래 거주 사유를 쓰세요.",
  housing_sale: "분양 청약은 자기소개서를 받지 않습니다. 청약 자격과 가점을 먼저 확인하세요.",
  exam: "자격증 시험 접수에는 자기소개서가 필요 없습니다.",
};

export function ruleDrafts(o: Opportunity, kind: PrepKind, p: Profile): PrepDraft[] {
  const name = `「${shortTitle(o.title, kind)}」`;
  const co = companyIn(o.title) ?? (isSourceName(o.org) ? undefined : o.org);
  const condAttrs = o.conditions.map((c) => c.attr);
  const facts = joinFacts(pickFacts(p, FACT_ORDER[kind], condAttrs));
  const lead = facts ? `${facts} ` : "";
  const money = benefitPhrase(o.summary);
  switch (kind) {
    case "job":
      return [
        { title: "지원 동기", body: `${co ? `${co}의 ` : ""}${name}에 지원합니다. ${lead}공고의 [관심 업무: 예) 자료 정리·보고서 작성] 업무에 [관련 경험: 예) 학과 프로젝트에서 설문 300건 엑셀 분석]을 살리고, 입사 후 [첫 목표: 예) 6개월 안에 정기 보고 업무 맡기]를 이루겠습니다.` },
        { title: "강점 3줄", list: true, body: "· [강점 1: 예) 엑셀 함수로 설문 300건 정리]\n· [강점 2: 예) 카페 아르바이트 1년, 마감 정산 담당]\n· [강점 3: 예) 컴퓨터활용능력 2급]" },
      ];
    case "job_event":
      return [
        { title: "30초 자기소개", body: `안녕하세요, [이름]입니다. ${lead}[관련 경험: 예) 고객 응대 아르바이트 1년]을 해 왔습니다. 오늘 ${co ? `${co}의 ` : ""}채용 계획을 듣고, [희망 직무: 예) 생산·품질 관리]로 일할 수 있는지 여쭙고 싶어 참여했습니다.` },
        { title: "현장에서 물어볼 질문", list: true, body: "1. 이 직무는 신입도 지원할 수 있습니까?\n2. 오늘 면접 뒤 다음 전형과 결과 안내는 언제입니까?\n3. 입사 전에 준비하면 좋은 역량은 무엇입니까?" },
      ];
    case "parttime":
      return [{ title: "지원 메시지", body: `안녕하세요, ${name} 공고를 보고 연락드립니다. ${lead}[가능 시간: 예) 토·일 오전 8~13시]에 근무할 수 있고, [관련 경험: 예) 카페 아르바이트 6개월]이 있습니다. 면접 가능한 시간을 알려 주시면 맞추겠습니다.` }];
    case "benefit_cash":
      return [
        { title: "신청 사유", body: `${lead}${name}의 ${money ? `'${money}'` : "[지원 내용: 예) 월 20만 원 지원]"}을 받아 [쓸 곳: 예) 월세 45만 원 중 일부]에 보태고자 신청합니다.` },
        { title: "활용 계획", list: true, body: "· 1~3개월: [예) 월세 일부 충당, 아낀 금액은 비상금으로 적립]\n· 4개월 이후: [예) 자격증 응시료와 교재비에 사용]" },
      ];
    case "benefit_service":
      return [{ title: "신청 사유", body: `${lead}${name}을 통해 [도움받고 싶은 점: 예) 진로 고민 상담]을 받고자 신청합니다. [지금 상황 한 줄: 예) 졸업 후 6개월째 진로를 정하지 못했습니다]` }];
    case "housing_rent":
      return [{ title: "거주 사유", body: `${lead}현재 [거주 형태: 예) 보증금 500만 원·월세 50만 원 원룸]에 살고 있어, ${name} 입주로 주거비를 줄이고자 합니다.` }];
    case "training":
      return [{ title: "수강 동기와 수료 후 계획", body: `${lead}${name}에서 [배우고 싶은 것: 예) 파이썬 데이터 처리와 시각화]를 익혀, 수료 후 [지원할 직무: 예) 데이터 분석 보조]로 취업하겠습니다.` }];
    default:
      return [];
  }
}

/** 다듬을 때 흔히 바뀌는 연결어(새 사실이 아님) */
const GLUE = "현재 지금 바로 그래서 따라서 또한 특히 이번 공고 통해 위해 하고자 하려고 있어 있으며 있습니다 합니다 받아 받고 신청 지원 참여 저는 제가 앞으로 이후 함께 적힌 맞춰 살려 시작 근무";

const BANNED = [/입니까|습니까\?/, /→/, /예\/아니오|아니오\)/, /인터뷰|제 상황\s?\(/, /판단했습니다/, /성실|책임감|열정|최선을 다/, /!/, /\d{6}-\d{7}|01[016789]-?\d{3,4}-?\d{4}|@[a-z0-9.-]+\.[a-z]{2,}/i];

/** 초안 품질 검사. 실패 사유 목록(빈 배열이면 통과) */
/** facts = 인터뷰 답에서 만든 사실 문장(여기 있는 숫자는 허용) */
export function checkDraft(d: PrepDraft, o: Pick<Opportunity, "title" | "org" | "summary">, opts: { ruleBlanks?: number; facts?: string; rule?: string } = {}): string[] {
  const ruleBlanks = opts.ruleBlanks ?? 0;
  const why: string[] = [];
  const b = d.body;
  const question = /질문/.test(d.title);
  for (const re of BANNED) {
    if (question && re.source.startsWith("입니까")) continue;
    if (re.test(b)) why.push(`금지 표현 ${re.source}`);
  }
  if (!question && /\?/.test(b)) why.push("물음표");
  if (!d.list) {
    const titleBit = o.title.replace(/[^가-힣A-Za-z0-9]/g, "");
    const plain = b.replace(/[^가-힣A-Za-z0-9]/g, "");
    const hasPosting = [...Array(Math.max(0, titleBit.length - 5))].some((_, i) => plain.includes(titleBit.slice(i, i + 6)))
      || (o.summary.match(/[가-힣]{4,}/g) ?? []).some((w) => b.includes(w));
    if (!hasPosting && !/「/.test(b)) why.push("공고 정보 없음");
    if (b.length < 60 || b.length > 420) why.push(`길이 ${b.length}`);
    const sentences = b.split(/(?<=[.。])\s+/).filter((s) => s.trim());
    const polite = sentences.filter((s) => /(니다|니다\.|니다\])\.?$|\]$/.test(s.trim())).length;
    if (sentences.length && polite / sentences.length < 0.8) why.push("습니다체 아님");
  }
  if (opts.rule) {
    if (opts.rule.includes("[이름]") && !b.includes("[이름]")) why.push("[이름] 삭제");
    if (b.length < opts.rule.length * 0.7) why.push("규칙 초안보다 너무 짧음");
    // 새 사실·이유를 덧붙이지 못하게: 문장 수가 늘거나 규칙 초안보다 30% 넘게 길면 실패
    const count = (x: string) => x.split(/(?<=[.。])\s+/).filter((v) => v.trim()).length;
    if (!d.list && count(b) > count(opts.rule)) why.push("문장 추가");
    if (b.length > opts.rule.length * 1.3) why.push("규칙 초안보다 너무 김");
    // 새 내용(사유·사실) 덧붙임 감지: 규칙 초안·공고·사실 문장·연결어에 없는 낱말(앞 두 글자 기준)이 하나라도 있으면 실패
    const stems = (x: string) => new Set((x.replace(/\[[^\]]*\]/g, " ").match(/[가-힣]{2,}/g) ?? []).map((w) => w.slice(0, 2)));
    const known = stems(`${opts.rule} ${o.title} ${o.org} ${o.summary} ${opts.facts ?? ""} ${GLUE}`);
    const novel = [...stems(b)].filter((w) => !known.has(w));
    if (novel.length > 0) why.push(`새 내용 추가(${novel.slice(0, 5).join("·")})`);
    // 빈칸은 규칙 초안과 글자까지 같아야 한다(예시를 바꿔 사실처럼 쓰지 못하게)
    const bl = (x: string) => (x.match(/\[[^\]]+\]/g) ?? []).sort().join("|");
    if (bl(b) !== bl(opts.rule)) why.push("빈칸 내용 변경");
  }
  if (/'[^']*(\s\/\s|\d{4}-\d{2})[^']*'/.test(b)) why.push("원문 필드를 그대로 인용");
  const blanks = (b.match(/\[[^\]]+\]/g) ?? []).filter((x) => x !== "[이름]");
  if (blanks.some((x) => !/예\)/.test(x))) why.push("빈칸 예시 없음");
  if (blanks.length < ruleBlanks) why.push("빈칸 삭제");
  const nums = (b.replace(/\[[^\]]*\]/g, "").match(/\d[\d,.]*/g) ?? []).filter((n) => !/^\d$/.test(n));
  const src = `${o.title} ${o.summary} ${opts.facts ?? ""}`;
  if (nums.some((n) => !src.includes(n))) why.push("공고에 없는 숫자");
  return why;
}
