// AI가 추가 질문을 못 만들 때(한도·장애) 쓰는 규칙 기반 세분화 질문.
// 실제 공고 분포를 검수해 정한 축(고용 형태·기관 유형·채용 행사·필요한 지원·주택·훈련 방식)으로
// 남은 후보를 가장 고르게 나누는 질문 하나를 고른다. 형식은 AI 추가 질문(Refinement)과 같다.
import type { Domain, Opportunity } from "../types";
import type { Refinement } from "./refinement";

/** id는 Jev 분류 태그 키(Opportunity.tags[id] = 선택지 label), domains는 이 축으로 분류할 공고 분야 */
export interface Facet { id: string; domains: Domain[]; text: string; why: string; options: { label: string; terms: string[] }[] }

export const RULE_FACETS: Facet[] = [
  { id: "employ", domains: ["job","parttime"], text: "어떤 고용 형태를 원하십니까?", why: "남은 채용 공고를 정규직·계약직·인턴으로 나눕니다.", options: [
    { label: "정규직", terms: ["정규직"] },
    { label: "계약·기간제", terms: ["기간제", "계약직", "임기제", "대체인력"] },
    { label: "인턴·체험형", terms: ["인턴", "체험형"] },
  ] },
  { id: "orgType", domains: ["job"], text: "어떤 곳에서 일하고 싶습니까?", why: "공공기관 공고와 기업 공고를 나눕니다.", options: [
    { label: "공공기관", terms: ["공공기관", "공단", "공사", "재단", "진흥원", "시청", "구청", "군청", "도청", "공무직"] },
    { label: "대기업·중견기업", terms: ["중견기업", "대기업", "그룹"] },
  ] },
  { id: "event", domains: ["job"], text: "개별 채용 공고와 채용 행사 중 무엇을 찾습니까?", why: "채용박람회·현장면접 같은 행사와 개별 공고를 나눕니다.", options: [
    { label: "개별 채용 공고", terms: ["공개채용", "수시채용", "신입", "경력", "채용 공고", "채용공고"] },
    { label: "채용박람회·현장 행사", terms: ["박람회", "수요데이", "만남의 날", "채용행사", "설명회", "면접행사"] },
  ] },
  { id: "need", domains: ["benefit"], text: "지금 가장 필요한 도움은 무엇입니까?", why: "지원 정책을 받는 도움의 종류로 나눕니다.", options: [
    { label: "현금·바우처", terms: ["지원금", "수당", "장려금", "바우처"] },
    { label: "주거비", terms: ["월세", "주거", "전세"] },
    { label: "교육·자격증", terms: ["교육", "훈련", "자격증", "강좌"] },
    { label: "창업", terms: ["창업"] },
    { label: "취업 연계", terms: ["취업", "일자리", "구직"] },
  ] },
  { id: "supportForm", domains: ["benefit"], text: "어떤 형태의 지원을 원하십니까?", why: "지원 정책을 받는 방식(현금·비용 지원·프로그램)으로 나눕니다.", options: [
    { label: "현금 지급(장학금·수당)", terms: ["지급", "장학금", "지원금", "수당", "장려금", "만원"] },
    { label: "비용 지원(바우처·할인)", terms: ["바우처", "비용", "구입비", "할인", "감면", "이용권"] },
    { label: "프로그램·서비스 참여", terms: ["프로그램", "서비스", "상담", "캠페인", "커뮤니티", "모집합니다"] },
  ] },
  { id: "benefitArea", domains: ["benefit"], text: "어떤 분야의 지원에 관심이 있습니까?", why: "지원 정책을 생활 분야별로 나눕니다.", options: [
    { label: "학업·장학", terms: ["장학", "학생", "재학", "학자금", "대학"] },
    { label: "출산·육아", terms: ["출산", "육아", "임신", "아동", "보육"] },
    { label: "문화·예술·체육", terms: ["문화", "예술", "체육", "스포츠", "도서", "공연"] },
    { label: "재무·금융", terms: ["재무", "금융", "자산", "저축", "적금", "대출"] },
    { label: "건강·돌봄", terms: ["건강", "돌봄", "심리", "의료", "마음"] },
  ] },
  { id: "housingKind", domains: ["housing"], text: "어떤 방식의 주택을 찾습니까?", why: "임대 주택과 분양 주택을 나눕니다.", options: [
    { label: "임대(행복주택·매입임대 등)", terms: ["행복주택", "국민임대", "매입임대", "전세임대", "영구임대", "임대"] },
    { label: "분양", terms: ["분양"] },
  ] },
  { id: "trainingMode", domains: ["training"], text: "어떤 방식의 훈련을 원하십니까?", why: "국비 지원 과정과 온라인 과정을 나눕니다.", options: [
    { label: "국비 지원 과정", terms: ["국민내일배움", "국비", "K-디지털"] },
    { label: "온라인·원격 과정", terms: ["온라인", "원격", "인터넷"] },
  ] },
];

const hit = (o: Opportunity, terms: string[]) => { const t = `${o.title} ${o.summary}`.toLowerCase(); return terms.some((x) => t.includes(x.toLowerCase())); };

/** 공고가 이 축의 선택지에 해당하는지. Jev 태그가 있으면 태그(해당 없음 판정 포함)만, 없으면 원문 단어로 판단 */
export function inFacetOption(o: Opportunity, f: Facet, label: string): boolean {
  const tag = o.tags?.[f.id];
  if (tag !== undefined && tag !== "?") return tag === label; // "?" = 분류했지만 확신 못 함 → 원문 단어로
  return hit(o, f.options.find((x) => x.label === label)?.terms ?? []);
}

/**
 * 남은 후보를 가장 고르게 나누는 규칙 질문. 쓸 만한 축이 없으면 null
 * - tagsOnly: Jev 태그가 붙은 공고만으로 축을 평가(AI 질문 생성 없이 바로 쓸 수 있는지 판단할 때)
 * - facets: 기본 칼럼 대신 쓸 칼럼 목록(서버에서 AI 추가 질문으로 생긴 칼럼까지 포함할 때)
 * facet(칼럼 id)을 함께 돌려줘, 적용할 때 칼럼 값이 있는 공고는 칼럼 값으로, 없는 공고는 원문 단어(terms)로 나눈다
 */
export function ruleRefinement(alive: Opportunity[], answered: { question: { text: string } }[], opts: { tagsOnly?: boolean; facets?: Facet[] } = {}): Refinement | null {
  const asked = new Set(answered.map((a) => a.question.text.split(" — ")[0].replace(/\s/g, "")));
  let best: { score: number; r: Refinement } | null = null;
  for (const f of opts.facets ?? RULE_FACETS) {
    if (asked.has(f.text.replace(/\s/g, ""))) continue;
    const pool = opts.tagsOnly ? alive.filter((x) => x.tags?.[f.id] !== undefined && x.tags[f.id] !== "?") : alive;
    // 태그 기준일 때는 축이 다루는 분야 공고가 남은 후보의 상당수(30%↑)여야 의미가 있다
    if (opts.tagsOnly && pool.length < Math.max(4, alive.filter((x) => f.domains.includes(x.domain)).length * 0.3)) continue;
    const options = f.options.map((o) => ({ label: o.label, terms: o.terms, ids: pool.filter((x) => inFacetOption(x, f, o.label)).map((x) => x.id) })).filter((o) => o.ids.length > 0);
    if (options.length < 2) continue;
    const classified = new Set(options.flatMap((o) => o.ids)).size;
    if (options.some((o) => o.ids.length >= classified)) continue; // 한 선택지가 전부를 덮으면 나누지 못한다
    const sizes = options.map((o) => o.ids.length);
    const balance = Math.min(...sizes) / Math.max(...sizes);
    const score = (classified / alive.length) * (0.4 + 0.6 * balance);
    if (!best || score > best.score) best = { score, r: { text: f.text, why: f.why, facet: f.id, options } };
  }
  return best && best.score > (opts.tagsOnly ? 0.08 : 0.03) ? best.r : null;
}
