import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ ask: vi.fn(), enabled: vi.fn(() => true) }));
vi.mock("@/lib/ai", () => ({ ask: mock.ask, aiEnabled: mock.enabled, FAST_MODEL: "test" }));
import { POST } from "./route";
const question = { id: "need:eq:교육", text: "어느 비용의 지원이 더 필요합니까?", why: "남은 공고의 지원 목적을 구분합니다.", options: [{ key: "0", label: "교육비" }, { key: "1", label: "생활비" }] };
const body = { total: 10, facets: [{ id: question.id, text: "필요한 지원", options: [{ key: "0", label: "교육비", remaining: 4 }, { key: "1", label: "생활비", remaining: 6 }] }], answered: [{ text: "관심 분야", answer: "지원금" }], evidence: [{ domain: "benefit", title: "교육비 지원", summary: "학습 비용 지원" }] };
const request = (data: unknown) => new Request("http://localhost/api/next-question", { method: "POST", body: JSON.stringify(data) });
beforeEach(() => { mock.ask.mockReset(); mock.enabled.mockReturnValue(true); });
describe("동적 질문 API", () => {
  it("새 질문·선택지를 생성하고 승인 범위 밖 프로필을 보내지 않는다", async () => {
    mock.ask.mockResolvedValue(JSON.stringify(question));
    const response = await POST(request({ ...body, name: "DO_NOT_SEND", location: { lat: 1, lng: 2 } }));
    expect(await response.json()).toEqual({ ai: true, id: question.id, question });
    const prompt = mock.ask.mock.calls[0][2];
    expect(prompt).not.toContain("DO_NOT_SEND");
    expect(prompt).not.toContain('"lat"');
    expect(prompt).toContain("교육비 지원");
    expect(mock.ask.mock.calls[0][1]).toContain("같은 의미의 질문");
  });
  it("잘못된 생성 응답은 사용하지 않는다", async () => {
    mock.ask.mockResolvedValue(JSON.stringify({ ...question, id: "invented" }));
    expect((await (await POST(request(body))).json()).ai).toBe(false);
  });
  it("API가 비활성일 때 성공한 것처럼 응답하지 않는다", async () => {
    mock.enabled.mockReturnValue(false);
    expect(await (await POST(request(body))).json()).toEqual({ ai: false, reason: "unavailable" });
    expect(mock.ask).not.toHaveBeenCalled();
  });
});
