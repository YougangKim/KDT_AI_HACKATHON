// AI 모듈: ANTHROPIC_API_KEY가 있으면 Claude, 없거나 실패하면 규칙 기반.
// 개인정보 보호: 외부로 보내는 것은 공고 원문·질문 범주값·매칭 근거 문구뿐이다(사용자 자유입력 없음).
import Anthropic from "@anthropic-ai/sdk";
import type { AttrKey, Condition, Match, Question } from "../types";
import { explainMatchRules, phraseQuestionRules, structureConditionsRules } from "./rules";

export { explainMatchRules, phraseQuestionRules, structureConditionsRules, normalizeRegion } from "./rules";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5";
const ATTRS: AttrKey[] = ["age", "region", "homeless", "livingAlone", "incomePct", "employment", "interest"];
const OPS = ["eq", "lte", "gte", "in"] as const;

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15_000, maxRetries: 1 }) : null;
  return client;
}

/** 테스트용: 클라이언트 캐시 초기화 */
export function _resetClient() {
  client = undefined;
}

async function ask(model: string, system: string, user: string, maxTokens: number): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const res = await c.messages.create({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return text || null;
  } catch (e) {
    console.warn("[ai] Claude 호출 실패, 규칙 기반으로 폴백:", (e as Error).message);
    return null;
  }
}

const STRUCTURE_SYSTEM = `너는 한국 청년 정책·공고의 자격요건 문장을 구조화한다.
JSON 배열만 출력한다. 각 원소: {"attr","op","value","rawText","confidence"}.
- attr: ${ATTRS.join(", ")} 중 하나만. 그 외 조건(학력, 자격증, 거주기간 등)은 출력하지 않는다.
  age=만 나이(number), region=시도 약칭 배열(서울, 부산, 대구, 인천, 광주, 대전, 울산, 세종, 경기, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주),
  homeless/livingAlone=boolean, incomePct=기준중위소득 대비 %(number), employment=["student","jobseeker","employed","parttime"]의 부분집합.
- op: eq, lte, gte, in. 나이 범위는 gte와 lte 두 개로 나눈다. region·employment는 in.
- rawText: 근거가 된 원문 구절 그대로.
- confidence: 원문에 명시돼 있으면 "high", 해석·환산이 필요하면(예: 연소득 금액→중위소득 %) "low".`;

function isCondition(x: unknown): x is Condition {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  if (!ATTRS.includes(c.attr as AttrKey) || !OPS.includes(c.op as (typeof OPS)[number])) return false;
  if (typeof c.rawText !== "string" || (c.confidence !== "high" && c.confidence !== "low")) return false;
  const v = c.value;
  const okScalar = (s: unknown) => typeof s === "number" || typeof s === "string" || typeof s === "boolean";
  return Array.isArray(v) ? v.length > 0 && v.every(okScalar) : okScalar(v);
}

/** AI 응답 문자열에서 Condition[]을 안전하게 꺼낸다. 실패하면 null */
export function parseConditionsJson(text: string): Condition[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    return arr.filter(isCondition);
  } catch {
    return null;
  }
}

/** 자격요건 원문 → 조건 목록 */
export async function structureConditions(rawText: string): Promise<Condition[]> {
  if (!rawText.trim()) return [];
  const text = await ask(MODEL, STRUCTURE_SYSTEM, rawText.slice(0, 4000), 1024);
  const parsed = text ? parseConditionsJson(text) : null;
  return parsed ?? structureConditionsRules(rawText);
}

/** 질문 → 게임 말투 문장 */
export async function phraseQuestion(q: Pick<Question, "attr" | "op" | "value">): Promise<string> {
  const fallback = phraseQuestionRules(q);
  const text = await ask(
    FAST_MODEL,
    "너는 청년 기회를 맞히는 스무고개 게임의 진행자다. 주어진 조건을 예/아니오로 답할 수 있는 반말 질문 한 문장(40자 이내)으로 바꾼다. 문장만 출력한다.",
    `조건: ${JSON.stringify({ attr: q.attr, op: q.op, value: q.value })}\n참고 문장: ${fallback}`,
    100,
  );
  const line = text?.split("\n")[0].trim();
  return line && line.length <= 80 ? line : fallback;
}

/** 매칭 결과 → 왜 맞는지 설명(1~2문장) */
export async function explainMatch(m: Match): Promise<string> {
  const fallback = explainMatchRules(m);
  const o = m.opportunity;
  const text = await ask(
    FAST_MODEL,
    "너는 청년에게 맞는 공고를 알려주는 도우미다. 주어진 근거만 사용해 반말 1~2문장으로 왜 맞는지와 확인할 점을 설명한다. 근거에 없는 사실(금액, 날짜)은 지어내지 않는다.",
    JSON.stringify({ 공고: o.title, 기관: o.org, 요약: o.summary, 마감: o.applyEnd ?? "상시", 맞는근거: m.reasons, 확인필요: m.unknowns.map((u) => u.rawText) }),
    200,
  );
  return text && text.length <= 300 ? text : fallback;
}

/** 서버에서 Claude가 켜져 있는지(화면의 "AI 생성" 표시 판단용) */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
