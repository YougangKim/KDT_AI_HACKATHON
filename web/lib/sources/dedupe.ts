// 여러 출처에 같은 공고가 올라온 경우 하나만 남긴다(공식 API > RSS > 웹 검색 > 샘플 순으로 우선)
import type { Opportunity } from "../types";

const rank = (o: Opportunity) => (o.isSample ? 3 : o.origin === "websearch" ? 2 : o.origin === "rss" ? 1 : 0);

/** 괄호·공백·특수문자·연도 표기 차이를 무시한 제목 키 */
export function titleKey(o: Pick<Opportunity, "title" | "domain">): string {
  const t = o.title
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
  return `${o.domain}:${t}`;
}

export function dedupeOpportunities(list: Opportunity[]): Opportunity[] {
  const best = new Map<string, Opportunity>();
  const order: string[] = [];
  for (const o of list) {
    let k = titleKey(o);
    // 같은 출처 안의 공고는 별개 레코드다(예: Q-Net 회차별 일정, 같은 단지의 여러 공고) → 합치지 않는다
    if (best.get(k)?.source === o.source) k = `${k}#${o.id}`;
    const cur = best.get(k);
    if (!cur) {
      best.set(k, o);
      order.push(k);
    } else if (rank(o) < rank(cur)) best.set(k, o);
  }
  return order.map((k) => best.get(k)!);
}
