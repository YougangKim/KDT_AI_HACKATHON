// 공고 분류(직무 분야·세분화 칼럼)를 Jev 판단 모델로 한다. 글 생성 LLM을 쓰지 않는다.
// - 분류는 공고를 DB(공고 풀)에 처음 넣을 때 한 번만 한다. 결과는 공고의 tags 칼럼으로 저장되고, 이후에는 읽기만 한다
// - 칼럼 단위로 관리: 이미 분류한 칼럼은 다시 묻지 않고, 새 질문으로 새 칼럼이 생기면 그 칼럼만 추가로 묻는다
// - 확신도가 기준 미만이면 UNSURE("?")로 남겨 기존 원문 단어 규칙으로 판단한다(오분류보다 미분류가 안전)
// - 숫자·날짜(나이·소득·마감)는 Jev가 약하므로 여기서 다루지 않는다
import type { Opportunity } from "../types";
import { askJev, jevEnabled, type JevQuestion } from "../ai/jev";
import type { Facet } from "../ai/refinement-rules";
import { FIELD_NAMES, OPEN_FIELD } from "./field";

/** 해당 선택지가 없거나 원문으로 알 수 없을 때의 Jev 선택지 키 */
const NONE = "none";
/** 물어봤지만 확신하지 못한 칼럼 값(다시 묻지 않고, 원문 단어 규칙으로 판단) */
export const UNSURE = "?";
/** 이 확신도 이상인 답만 칼럼 값으로 쓴다 */
export const MIN_CONFIDENCE = 0.75;
const CONCURRENCY = 6;
/** 한 요청에 묶는 최대 질문 수(새 칼럼이 많이 쌓여도 요청이 너무 커지지 않게) */
const MAX_QUESTIONS = 12;

/** 직무 분야 칼럼 키(Opportunity.tags.field). 값은 FIELD_NAMES 중 하나·OPEN_FIELD·UNSURE */
export const FIELD_TAG = "field";

/** 칼럼 값이 실제 분류 결과인지(미분류·확신 못 함 제외) */
export const known = (v: string | undefined): v is string => v !== undefined && v !== UNSURE;

function fieldQuestion(): JevQuestion {
  const criteria: Record<string, string> = Object.fromEntries(FIELD_NAMES.map((f, i) => [`f${i}`, `${f} 직무`]));
  criteria.open = "직무를 정하지 않은 일반 채용(신입 공채·인턴·채용박람회·공무직 등, 전공·경력 제한 없음)";
  criteria[NONE] = "직무를 공고에서 알 수 없음";
  return { type: "choice", instructions: "이 채용 공고가 뽑는 사람의 직무 분야는 무엇인가? 기관 이름이 아니라 실제로 하는 일로 고르세요.", criteria };
}

function facetQuestion(f: Facet): JevQuestion {
  const criteria: Record<string, string> = Object.fromEntries(f.options.map((opt, i) => [`o${i}`, opt.label]));
  criteria[NONE] = "어느 쪽도 아니거나 공고로 알 수 없음";
  return { type: "choice", instructions: `이 공고는 다음 중 어디에 해당하는가? 공고에 드러난 내용으로만 고르세요. (${f.text} ${f.why})`, criteria };
}

/** 이 공고에 아직 분류하지 않은 칼럼의 질문들. 키: FIELD_TAG 또는 칼럼 id */
export function missingQuestions(o: Pick<Opportunity, "domain" | "tags">, facets: Facet[]): Record<string, JevQuestion> {
  const qs: Record<string, JevQuestion> = {};
  const done = o.tags ?? {};
  if ((o.domain === "job" || o.domain === "parttime") && !(FIELD_TAG in done)) qs[FIELD_TAG] = fieldQuestion();
  for (const f of facets) if (f.domains.includes(o.domain) && !(f.id in done)) qs[f.id] = facetQuestion(f);
  return Object.fromEntries(Object.entries(qs).slice(0, MAX_QUESTIONS));
}

/** Jev 답 → 칼럼 값. 확신 미달은 UNSURE, 확신하는 "해당 없음"은 "" */
export function answersToTags(facets: Facet[], answers: Record<string, { type: string; choice?: string; confidence?: number }>): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const [key, a] of Object.entries(answers)) {
    if (a.type !== "choice" || !a.choice) continue;
    const sure = (a.confidence ?? 0) >= MIN_CONFIDENCE;
    if (key === FIELD_TAG) {
      // 직무를 모르면(none) 기존 키워드·미표기 규칙에 맡긴다
      tags[key] = !sure || a.choice === NONE ? UNSURE : a.choice === "open" ? OPEN_FIELD : FIELD_NAMES[Number(a.choice.slice(1))] ?? UNSURE;
      continue;
    }
    const facet = facets.find((f) => f.id === key);
    if (!facet) continue;
    tags[key] = !sure ? UNSURE : a.choice === NONE ? "" : facet.options[Number(a.choice.slice(1))]?.label ?? UNSURE;
  }
  return tags;
}

/** Jev에 보낼 상태: 제목·기관·요약만 짧게(잡음이 많으면 정확도가 떨어진다) */
export function jevState(o: Pick<Opportunity, "title" | "org" | "summary">): string {
  return `공고 제목: ${o.title.slice(0, 160)}\n기관: ${(o.org ?? "").slice(0, 60)}\n요약: ${(o.summary ?? "").replace(/\s+/g, " ").slice(0, 400)}`;
}

/** 아직 분류하지 않은 칼럼이 있는 공고인지 */
export function needsTags(o: Opportunity, facets: Facet[]): boolean {
  return Object.keys(missingQuestions(o, facets)).length > 0;
}

/** 다시 수집한 공고에 이전 DB의 칼럼 값을 그대로 옮긴다(같은 공고·같은 분류 입력이면 다시 묻지 않는다) */
export function carryTags(items: Opportunity[], previous: Opportunity[]): Opportunity[] {
  const old = new Map(previous.filter((o) => o.tags).map((o) => [o.id, o]));
  return items.map((o) => {
    const p = old.get(o.id);
    // 분류 입력(제목·기관·요약)이 하나라도 바뀌면 이월하지 않고 다시 분류한다
    return p && jevState(p) === jevState(o) && !o.tags ? { ...o, tags: p.tags } : o;
  });
}

/**
 * 아직 분류하지 않은 칼럼만 Jev에 물어 tags에 더한다(DB에 넣기 전 한 번).
 * limit: 이번에 새로 보낼 요청 수 상한, deadline: 새 요청을 시작하지 않을 시각(나머지는 다음 수집 때).
 * 실패했거나 답이 빠진 칼럼은 비워 두어 다음 수집 때 그 칼럼만 다시 묻는다
 */
export async function attachTags(items: Opportunity[], facets: Facet[], opts: { limit?: number; deadline?: number } = {}): Promise<{ items: Opportunity[]; asked: number }> {
  if (!jevEnabled()) return { items, asked: 0 };
  let budget = opts.limit ?? 400;
  const deadline = opts.deadline ?? Infinity; // 이 시각(ms) 이후에는 새 요청을 시작하지 않는다(서버리스 제한시간 대비)
  let asked = 0;
  const out = items.slice();
  let next = 0;
  const worker = async () => {
    while (next < items.length && budget > 0 && Date.now() < deadline) {
      const i = next++;
      const o = items[i];
      const qs = missingQuestions(o, facets);
      if (!Object.keys(qs).length) continue;
      budget--;
      asked++;
      const answers = await askJev(jevState(o), qs);
      if (answers) out[i] = { ...o, tags: { ...(o.tags ?? {}), ...answersToTags(facets, answers) } };
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { items: out, asked };
}
