// 신청 준비: 공고(이미 가진 데이터)와 인터뷰 답을 조합해 대상 판정·조건 비교·한눈에 요약·준비물·순서·초안을 만든다.
// 설계: docs/설계/신청준비_페이지_설계.md. AI가 없거나 실패해도 규칙만으로 전부 나온다.
import type { AnswerRecord, AttrKey, Match, Opportunity } from "@/lib/types";
import { cleanTitle, companyIn, KIND_LABEL, prepKind, targetCheck, type PrepKind, type TargetCheck } from "./kind";
import { allFacts, buildProfile, shortAnswer, type Profile } from "./profile";
import { benefitPhrase, FACT_ORDER, NO_DRAFT_NOTE, ruleDrafts, type PrepDraft } from "./draft";

export type { PrepDraft } from "./draft";
export type { PrepKind } from "./kind";

export interface CompareRow { cond: string; note?: string; mine: string; verdict: "ok" | "check" }
export interface PrepDoc { name: string; src: "posting" | "usual" | "mine"; tag: string }
export interface PrepStep { when: string; text: string }
export interface Glance { what?: string; whatNote?: string; when?: string; where?: string; how?: string }

export interface PrepPlan {
  kind: PrepKind;
  kindLabel: string;
  title: string; // 정리한 제목
  series?: string; // 제목 앞 괄호(행사 시리즈명)
  target: TargetCheck;
  rows: CompareRow[]; // 자격 조건 비교
  prefs: string[]; // 찾던 것과 맞는 점(취향 조건)
  glance: Glance;
  docs: PrepDoc[];
  docsFromPosting: boolean;
  steps: PrepStep[];
  drafts: PrepDraft[];
  draftNote?: string;
  facts: string[]; // AI에 넘길 사실 문장(질문 원문 아님)
  ai: boolean;
}

const ELIG: AttrKey[] = ["age", "region", "homeless", "livingAlone", "incomePct", "employment", "subscription", "married", "welfare", "experienced", "education"];
const PREF: AttrKey[] = ["interest", "field", "need", "housingKind", "topic"];

/** 공고 요약·조건 문구에서 서류 이름을 뽑는다 */
function docsFromText(text: string): string[] {
  const found = text.match(/[가-힣·]{2,14}\s?(증명서|확인서|사본|등본|초본|원서|계획서|포트폴리오)/g) ?? [];
  return [...new Set(found)];
}

const USUAL: Record<PrepKind, string[]> = {
  job: ["이력서", "자기소개서(공고 문항 확인)", "최종학력 증명서"],
  job_event: ["참가 신청 방법·사전신청 여부 확인", "이력서 출력본 3~5부", "행사 일시·장소 확인"],
  parttime: ["간단한 이력서", "근무 가능한 요일·시간 정리"],
  benefit_cash: ["신분증", "통장 사본", "주민등록등본"],
  benefit_service: ["신분증"],
  housing_rent: ["주민등록등본", "가족관계증명서", "소득·자산 증빙"],
  housing_sale: ["청약통장", "주민등록등본", "가족관계증명서"],
  training: ["국민내일배움카드", "신분증"],
  exam: ["응시원서", "증명사진", "응시료 결제 수단"],
};

function mineDocs(kind: PrepKind, p: Profile, o: Opportunity): PrepDoc[] {
  const d = (name: string, tag: string): PrepDoc => ({ name, src: "mine", tag });
  const out: PrepDoc[] = [];
  const co = companyIn(o.title);
  if (kind === "job") {
    if (p.experienced === false) out.push(d("경험 정리표(알바·프로젝트)", "신입이라서"));
    if (p.employment === "student") out.push(d("졸업예정증명서", "학생이라서"));
  }
  if (kind === "job_event" && co) out.push({ name: `${co} 모집 직무·근무지 확인`, src: "posting", tag: "제목에서" });
  if (kind === "benefit_cash") {
    if (p.incomePct) out.push(d("건강보험료 납부확인서", "소득 기준 때문에"));
    if (p.employment === "jobseeker" && /구직|취업|활동계획/.test(o.title + o.summary)) out.push(d("구직활동 계획(양식은 원문 확인)", "구직 중이라서"));
  }
  if (kind === "housing_rent") {
    if (p.homeless) out.push(d("무주택 확인(세대원 주택 소유 여부)", "무주택이라서"));
    if (p.subscription) out.push(d("청약통장 가입확인서", "청약통장 있음"));
    if (p.livingAlone) out.push(d("등본의 세대 구성(1인 가구) 확인", "1인 가구라서"));
  }
  if (kind === "housing_sale" && p.subscription === false) out.push(d("청약통장 가입(없으면 신청이 어려울 수 있음)", "청약통장 없음"));
  if (kind === "training") out.push(d("내일배움카드 발급(2~3주 걸림)", "미리 준비"));
  return out;
}

const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function eventDate(o: Opportunity): string | undefined {
  return o.summary.match(/행사\s*([0-9][0-9.\-~\s:]+[0-9])/)?.[1]?.trim();
}

function steps(kind: PrepKind, o: Opportunity, now: Date): PrepStep[] {
  const end = o.applyEnd ? dayOnly(new Date(o.applyEnd)) : null;
  const today = dayOnly(now);
  const left = end ? Math.round((end.getTime() - today.getTime()) / 864e5) : null;
  const by = (n: number) => {
    if (!end || left === null) return "이번 주 안";
    if (left <= 0) return "오늘 안";
    const t = new Date(end.getTime() - Math.min(n, left) * 864e5);
    return t.getTime() <= today.getTime() ? "오늘 안" : `${md(t)}까지`;
  };
  const deadline = !end ? "이번 주 안" : left !== null && left <= 0 ? "오늘 마감 전" : `${md(end)} 마감 전`;
  const where = o.apply?.where ? `${o.apply.where}에서 ` : "";
  switch (kind) {
    case "job": return [
      { when: "오늘", text: "직무 내용·우대사항 확인" },
      { when: by(3), text: "자기소개서·이력서 작성(마감 3일 전 완료)" },
      { when: deadline, text: `${where}온라인 접수` },
      { when: "접수 후", text: "접수 완료 메일·문자 확인" },
    ];
    case "job_event": return [
      { when: "지금", text: "원문에서 참가 대상(나이)과 사전신청 여부 확인" },
      { when: deadline, text: "대상이면 참가 신청" },
      { when: "신청 후", text: "참여 기업 모집 직무를 보고 이력서 맞추기" },
      { when: "행사 전날", text: "이력서 출력" },
      { when: eventDate(o) ? `행사 ${eventDate(o)}` : "행사일", text: eventDate(o) ? "현장 면접" : "현장 면접 (날짜 원문 확인)" },
    ];
    case "parttime": return [
      { when: "오늘", text: "시급·근무 시간·장소 확인" },
      { when: "바로", text: "지원 메시지 보내기" },
      { when: "연락 후", text: "면접 일정 잡기" },
    ];
    case "benefit_cash": return [
      { when: "오늘", text: "나이·소득 기준 원문 확인" },
      { when: by(5), text: "정부24에서 등본·소득 증빙 발급" },
      { when: deadline, text: `${where}신청·서류 업로드` },
      { when: "신청 후", text: "심사 결과 확인" },
    ];
    case "benefit_service": return [
      { when: "오늘", text: "참여 대상 확인" },
      { when: deadline, text: `${where}신청` },
      { when: "신청 후", text: "안내 연락 확인" },
    ];
    case "housing_rent": return [
      { when: "오늘", text: "공급 단지·자격(무주택·소득) 확인" },
      { when: by(5), text: "등본·소득 증빙 발급" },
      { when: deadline, text: `${where}청약 신청` },
      { when: "발표 후", text: "서류 제출 대상이면 서류 제출 → 당첨 발표·계약" },
    ];
    case "housing_sale": return [
      { when: "오늘", text: "청약 자격·가점 확인" },
      { when: deadline, text: "청약홈에서 청약 신청" },
      { when: "발표일", text: "당첨 확인 후 계약" },
    ];
    case "training": return [
      { when: "오늘", text: "내일배움카드 확인(없으면 바로 발급 신청)" },
      { when: "이번 주", text: "훈련기관 상담" },
      { when: deadline, text: `${where}수강 신청` },
      { when: "선발", text: "면접이 있으면 수강 동기 준비" },
    ];
    case "exam": return [
      { when: "오늘", text: "응시 자격 확인" },
      { when: deadline, text: "원서 접수" },
      { when: "시험 전", text: "수험표 출력" },
    ];
  }
}

function glance(kind: PrepKind, o: Opportunity): Glance {
  const parts = o.summary.split(/\s\/\s|(?<=[.。])\s+/).map((s) => s.trim()).filter(Boolean);
  const co = companyIn(o.title);
  const g: Glance = {};
  if (kind === "job_event") {
    if (co) { g.what = `${co} 현장 면접`; g.whatNote = "제목에서"; }
    const ev = parts.find((s) => s.startsWith("행사"));
    if (ev) g.when = ev;
    const area = parts.find((s) => !s.startsWith("행사"));
    g.where = o.place || area;
  } else {
    const money = benefitPhrase(o.summary);
    const first = parts.find((s) => !/^\d/.test(s));
    g.what = money ? `${money}${first && !first.includes(money) ? ` · ${first.slice(0, 40)}` : ""}` : first?.slice(0, 60);
    g.where = o.place || (o.region.length ? o.region.join("·") : undefined);
  }
  if (!g.when) {
    const s = o.applyStart ? new Date(o.applyStart) : null, e = o.applyEnd ? new Date(o.applyEnd) : null;
    g.when = s && e ? `접수 ${md(s)}~${md(e)}` : e ? `${md(e)} 마감` : "상시 접수(예산 소진 시 조기 마감 가능)";
  }
  g.how = [o.apply?.where, o.apply?.how].filter(Boolean).join(" · ") || undefined;
  return g;
}

export function ruleBasedPlan(m: Match, answers: AnswerRecord[], now = new Date()): PrepPlan {
  const o = m.opportunity;
  const kind = prepKind(o);
  const p = buildProfile(answers);
  const target = targetCheck(o, p, m.status === "needs_check", now);
  const unknownText = new Set(m.unknowns.map((c) => c.rawText));

  const rows: CompareRow[] = [];
  const seen = new Set<string>();
  for (const c of o.conditions) {
    if (!ELIG.includes(c.attr) || seen.has(c.rawText)) continue;
    seen.add(c.rawText);
    const mine = shortAnswer(p, c.attr);
    rows.push({ cond: c.rawText, mine: mine ?? "답하지 않음", verdict: mine && !unknownText.has(c.rawText) ? "ok" : "check" });
  }
  if (target.titleAge && !o.conditions.some((c) => c.attr === "age")) {
    rows.unshift({ cond: "나이 — 원문에 숫자 없음", note: `제목 '${target.titleAge}'`, mine: shortAnswer(p, "age") ?? "답하지 않음", verdict: "check" });
  }
  if (o.region.length && !o.region.some((r) => /전국/.test(r)) && !o.conditions.some((c) => c.attr === "region")) {
    rows.push({ cond: `지역 — ${o.region.join("·")}`, mine: shortAnswer(p, "region") ?? "답하지 않음", verdict: target.level !== "block" && p.region ? "ok" : "check" });
  }
  const prefs = [...new Set(o.conditions.filter((c) => PREF.includes(c.attr)).map((c) => c.rawText.replace(/^[^:]{1,8}:\s*/, "")))].slice(0, 4);

  const text = [o.summary, ...o.conditions.map((c) => c.rawText)].join(" ");
  const posting: PrepDoc[] = docsFromText(text).map((name) => ({ name, src: "posting", tag: "공고 명시" }));
  const docs: PrepDoc[] = [];
  for (const d of [...posting, ...mineDocs(kind, p, o), ...USUAL[kind].map((name): PrepDoc => ({ name, src: "usual", tag: "보통 필요" }))]) {
    if (!docs.some((x) => x.name === d.name)) docs.push(d);
  }

  const drafts = ruleDrafts(o, kind, p);
  const ct = cleanTitle(o.title);
  return {
    kind,
    kindLabel: KIND_LABEL[kind],
    title: ct.title,
    series: [ct.series, ct.num && `${ct.num}회`].filter(Boolean).join(" ") || undefined,
    target,
    rows,
    prefs,
    glance: glance(kind, o),
    docs: docs.slice(0, 7),
    docsFromPosting: posting.length > 0,
    steps: target.expired ? [{ when: "지금", text: "원문에서 연장·추가 모집 여부 확인" }] : steps(kind, o, now),
    drafts,
    draftNote: NO_DRAFT_NOTE[kind],
    facts: allFacts(p).filter((f) => FACT_ORDER[kind].includes(f.attr) || o.conditions.some((c) => c.attr === f.attr)).map((f) => f.s).slice(0, 4),
    ai: false,
  };
}

/** 복사·인쇄용 전체 텍스트. 대상 확인 전(warn·block)에는 초안을 넣지 않는다(withDrafts로 사용자가 연 경우만) */
export function planText(plan: PrepPlan, o: Opportunity, withDrafts = plan.target.level === "ok" || plan.target.level === "check"): string {
  return [
    `[${plan.title}] ${o.org}`,
    `마감: ${o.applyEnd?.slice(0, 10) ?? "상시"}`,
    plan.target.level !== "ok" ? `※ ${plan.target.head}: ${plan.target.why}` : "",
    "",
    "■ 준비 서류", ...plan.docs.map((d) => `- ${d.name} (${d.tag})`),
    "", "■ 신청 순서", ...plan.steps.map((s, i) => `${i + 1}. [${s.when}] ${s.text}`),
    ...(withDrafts ? plan.drafts.flatMap((d) => ["", `■ ${d.title}`, d.body]) : []),
    "", `원문: ${o.apply?.url || o.url}`,
  ].join("\n");
}

