import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/ai", () => ({ aiEnabled: () => true, FAST_MODEL: "fixture", ask: vi.fn() }));
import { ask } from "@/lib/ai";
import { POST } from "./route";
const request = () => new Request("http://localhost/api/refine-question", { method:"POST", body: JSON.stringify({ evidence:[{id:"a",title:"월세 지원",summary:"",domain:"benefit"},{id:"b",title:"교육비 지원",summary:"",domain:"benefit"}],answered:[] }) });
describe("새 질문 API", () => {
  beforeEach(() => vi.clearAllMocks());
  it("고정 facets 없이 원문과 이력을 전달합니다", async () => {
    vi.mocked(ask).mockResolvedValue(JSON.stringify({text:"어떤 비용을 줄이고 싶습니까?",why:"지원 항목을 구분합니다.",options:[{label:"주거비",terms:["월세"]},{label:"교육비",terms:["교육비"]}]}));
    const body = await (await POST(request())).json();
    expect(body.ai).toBe(true);
    expect(body.question.options[0].ids).toEqual(["a"]);
    const input = JSON.parse(vi.mocked(ask).mock.calls[0][2]);
    expect(Object.keys(input).sort()).toEqual(["answered","evidence"]);
  });
  it("제공자 실패를 질문 소진으로 오인하지 않습니다", async () => {
    vi.mocked(ask).mockResolvedValue(null);
    expect(await (await POST(request())).json()).toEqual({ai:false,reason:"provider_unavailable"});
  });
});
