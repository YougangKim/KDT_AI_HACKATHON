import { afterEach, describe, expect, it } from "vitest";
import { fetchShRss, isRecruitment, parseRss, toOpportunity } from "./sh-rss";

const XML = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[2026년 청년안심주택 입주자 모집공고]]></title><link>http://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_241/view.do?seq=1</link><pubDate>Fri, 20 Nov 2026 05:40:30 GMT</pubDate><content:encoded>본문</content:encoded></item>
<item><title>2026년 행복주택 당첨자 발표</title><link>http://www.i-sh.co.kr/a?seq=2</link><pubDate>Thu, 19 Nov 2026 12:15:14 GMT</pubDate></item>
<item><title>외부 링크 모집</title><link>https://evil.example.com/x</link><pubDate></pubDate></item>
</channel></rss>`;

afterEach(() => {
  delete process.env.SH_RSS_ENABLED;
});

describe("SH 공식 RSS(선택 기능)", () => {
  it("제목·링크·게시일만 읽고 본문은 버린다", () => {
    const items = parseRss(XML);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      title: "2026년 청년안심주택 입주자 모집공고",
      link: "http://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_241/view.do?seq=1",
      pubDate: "Fri, 20 Nov 2026 05:40:30 GMT",
    });
  });
  it("모집 공고만 남기고 당첨자 발표는 뺀다", () => {
    expect(isRecruitment("2026년 청년안심주택 입주자 모집공고")).toBe(true);
    expect(isRecruitment("2026년 행복주택 당첨자 발표")).toBe(false);
  });
  it("SH 도메인만 https 링크로 변환하고 RSS 출처로 표시한다", () => {
    const now = new Date("2026-11-21T00:00:00Z");
    const [a, , c] = parseRss(XML);
    const o = toOpportunity(a, now)!;
    expect(o.url.startsWith("https://www.i-sh.co.kr/")).toBe(true);
    expect(o.origin).toBe("rss");
    expect(o.domain).toBe("housing");
    expect(o.summary).toContain("2026-11-20");
    expect(toOpportunity(c, now)).toBeNull();
  });
  it("기본값은 꺼져 있어 네트워크를 쓰지 않는다", async () => {
    expect(await fetchShRss()).toEqual([]);
  });
});
