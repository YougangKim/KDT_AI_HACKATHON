import { FAST_MODEL, ask, auxAiEnabled } from "../ai";
import { getCached, setCached } from "../ai/cache";
import type { Opportunity } from "../types";
import { getEligibility } from "../sources/util";
import { SHORT_ADDRESS_RE, workplaceValues } from "./workplace";

export interface ExtractedPlace {
  address: string | null;
  place: string | null;
}

const cache = new Map<string, ExtractedPlace>();
const pending = new Set<string>();
const MAX_AI_EXTRACTIONS = 30;
const CONCURRENCY = 2;
const ADDRESS_RE =
  /[가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도)\s+[가-힣0-9]+(?:시|군|구)(?:\s+[가-힣0-9]+구)?(?:\s+[가-힣0-9·.-]+(?:읍|면|동|가|로|길)(?:\s+\d+(?:-\d+)?)?)?/;
const EXTRACT_PROMPT_VERSION = "place-v3";

const isRecruit = (o: Opportunity) => o.domain === "job" || o.domain === "parttime";
/** 채용 공고 원문 중 근무지 라벨 값만(기관명·본사·접수처 주소 제외) */
function workplaceText(o: Opportunity): string {
  return workplaceValues([o.summary, getEligibility(o)].filter(Boolean).join("\n")).join(" / ");
}

export function _clearExtractCache() {
  cache.clear();
  pending.clear();
}

export function parsePlaceJson(text: string): ExtractedPlace | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const address = typeof value.address === "string" && value.address.trim() ? value.address.trim() : null;
    const place = typeof value.place === "string" && value.place.trim() ? value.place.trim() : null;
    return { address, place };
  } catch {
    return null;
  }
}

export function extractPlaceRules(opportunity: Opportunity): ExtractedPlace | null {
  const application = [opportunity.apply?.how, opportunity.apply?.where].filter(Boolean).join(" ");
  if (!isRecruit(opportunity) && /방문|현장|내방/.test(application) && opportunity.apply?.where) {
    const address = opportunity.apply.where.match(ADDRESS_RE)?.[0]?.trim();
    if (address) return { address, place: null };
    if (/(?:센터|청|사무소|회관|공단|지사)/.test(opportunity.apply.where)) return { address: null, place: opportunity.apply.where };
  }
  const text = isRecruit(opportunity)
    ? workplaceText(opportunity)
    : [opportunity.title, opportunity.summary, opportunity.org, getEligibility(opportunity)].filter(Boolean).join(" ");
  // 청약홈은 요약 첫 부분이 공급 위치 주소 그대로라 가장 정확하다
  if (opportunity.source === "applyhome") {
    const first = opportunity.summary.split(" · ", 1)[0].trim();
    const m = first.match(ADDRESS_RE)?.[0]?.trim();
    if (m) return { address: m, place: null };
    if (first && /(?:시|군|구|읍|면|동|로|길)/.test(first)) return { address: first, place: null };
  }
  const address = (text.match(ADDRESS_RE) ?? (isRecruit(opportunity) ? text.match(SHORT_ADDRESS_RE) : null))?.[0]?.trim();
  if (address) return { address, place: null };
  return null;
}

function cacheInput(opportunity: Opportunity): string {
  return `${EXTRACT_PROMPT_VERSION}\n${JSON.stringify({
    제목: opportunity.title,
    기관: opportunity.org,
    요약: opportunity.summary,
    자격요건: getEligibility(opportunity) ?? "",
  })}`;
}

export async function extractPlace(opportunity: Opportunity): Promise<ExtractedPlace> {
  // 근무지 표기가 없는 채용 공고는 AI도 추측하지 않게 한다(기관 본사 주소 오인 방지)
  if (isRecruit(opportunity) && !workplaceText(opportunity)) return { address: null, place: null };
  const ruled = extractPlaceRules(opportunity);
  if (ruled) return ruled;
  const hit = cache.get(opportunity.id);
  if (hit) return hit;
  const persisted = await getCached<ExtractedPlace>("place", cacheInput(opportunity));
  if (persisted) {
    cache.set(opportunity.id, persisted);
    return persisted;
  }
  if (!auxAiEnabled()) return { address: null, place: null }; // 부가 작업: 기본은 규칙·저장된 결과만(AI_AUX=1이면 AI 추출)

  const text = await ask(
    FAST_MODEL,
    '한국 공고에서 실제 근무지 또는 주택 소재지를 찾는다. 추측하지 말고 JSON 한 줄 {"address":string|null,"place":string|null}만 출력합니다. 도로명·지번 주소는 address, 기관·단지·역 등 장소명은 place에 둔다.',
    JSON.stringify({
      제목: opportunity.title,
      기관: opportunity.org,
      요약: opportunity.summary,
      자격요건: getEligibility(opportunity) ?? "",
    }),
    120,
  );
  const result = (text && parsePlaceJson(text)) || { address: null, place: null };
  cache.set(opportunity.id, result); // 실패도 캐시해 무료 한도를 반복 소모하지 않는다
  await setCached("place", cacheInput(opportunity), result, text ? 365 : 1);
  return result;
}

/**
 * 규칙 결과와 기존 AI 캐시는 즉시 반영하고, 새 AI 추출은 뒤에서 최대 30건·동시 2건만 수행합니다.
 * 따라서 공고 목록 응답은 AI를 기다리지 않는다.
 */
export function attachPlaces(items: Opportunity[]): Opportunity[] {
  const output = items.map((item) => {
    if (item.place) return item;
    const extracted = extractPlaceRules(item) ?? cache.get(item.id);
    const place = extracted?.address ?? extracted?.place;
    return place ? { ...item, place } : item;
  });

  const candidates = items
    .filter((item) => !item.place && !(isRecruit(item) && !workplaceText(item)) && !extractPlaceRules(item) && !cache.has(item.id) && !pending.has(item.id))
  void (async () => {
    for (const item of candidates) {
      const hit = await getCached<ExtractedPlace>("place", cacheInput(item));
      if (hit) cache.set(item.id, hit);
    }
  })();
  // 저장된 결과는 위에서 읽어 두고, 새 AI 추출은 부가 작업이 켜져 있을 때만
  if (!auxAiEnabled()) return output;
  const todo = candidates
    .filter((item) => !cache.has(item.id))
    .slice(0, MAX_AI_EXTRACTIONS);
  todo.forEach((item) => pending.add(item.id));
  if (!todo.length) return output;

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const item = todo[next++];
      try {
        await extractPlace(item);
      } finally {
        pending.delete(item.id);
      }
    }
  };
  void Promise.all(Array.from({ length: CONCURRENCY }, worker)).catch(() => {});
  return output;
}
