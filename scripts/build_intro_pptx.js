// My News 프로젝트 소개서 PPTX 생성 (pptxgenjs). 실행: node build.js
const pptxgen = require("pptxgenjs");
const path = require("path");
const A = (f) => path.join(__dirname, "../../docs/intro/assets", f);
const OUT = path.join(__dirname, "../../docs/intro/MyNews_프로젝트소개서.pptx");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "My News 프로젝트 소개서";
pres.author = "김유강";
const FONT = "Malgun Gothic";
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

const INK = "14161F", SUB = "5B6170", LINE = "E3E5EC", AC = "4F46E5", ACL = "EEF0FF", BG = "F6F7FA", MUTE = "9AA0AD", WHITE = "FFFFFF", AC2 = "A5A8FF", WARN = "D97706";

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: WHITE },
  objects: [
    { text: { text: "2026 대한민국 청년 CAREER FAIR AI 해커톤 | 프로젝트소개서", options: { x: 0.6, y: 7.05, w: 8, h: 0.3, fontSize: 10, color: MUTE, fontFace: FONT } } },
  ],
  slideNumber: { x: 12.3, y: 7.05, w: 0.5, h: 0.3, fontSize: 10, color: MUTE, fontFace: FONT, align: "right" },
});

let n = 0;
const T = (s, o) => s.addText(o.text, { isTextBox: true, fontFace: FONT, margin: 0, valign: "top", ...o, text: undefined });
function head(s, no, title) {
  T(s, { text: no, x: 0.6, y: 0.4, w: 6, h: 0.3, fontSize: 12, bold: true, color: AC });
  T(s, { text: title, x: 0.6, y: 0.7, w: 12, h: 0.65, fontSize: 30, bold: true, color: INK });
}
function card(s, x, y, w, h, fill = BG, name) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.12, objectName: name });
}
function tag(s, text, x, y, fill = ACL, color = AC) {
  // 라벨 글자의 왼쪽 끝을 아래 제목·본문과 같은 x에 맞춘다(알약 배경만 왼쪽으로 0.12" 여백)
  const w = 0.15 * text.length + 0.3;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.12, y, w, h: 0.3, fill: { color: fill }, line: { color: fill }, rectRadius: 0.15 });
  T(s, { text, x, y, w: w - 0.12, h: 0.3, fontSize: 11, bold: true, color, valign: "middle" });
}
function phone(s, img, x, y, w, cap) {
  const h = w * (844 / 390);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.07, y: y - 0.07, w: w + 0.14, h: h + 0.14, fill: { color: "1C1E26" }, line: { color: "1C1E26" }, rectRadius: 0.18 });
  s.addImage({ path: A(img), x, y, w, h, rounding: false, altText: cap || img });
  if (cap) T(s, { text: cap, x: x - 0.3, y: y + h + 0.12, w: w + 0.6, h: 0.3, fontSize: 11, color: SUB, align: "center", bold: true });
}
function src(s, text, x, y, w, h = 0.4) { T(s, { text, x, y, w, h, fontSize: 9.5, color: MUTE }); }
function arrow(s, x1, y1, x2, y2, color = AC) {
  s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color, width: 2, endArrowType: "triangle" } });
}
function box(s, x, y, w, h, title, body, fill = ACL, tcolor = AC, bcolor = INK) {
  card(s, x, y, w, h, fill);
  T(s, { text: title, x: x + 0.18, y: y + 0.14, w: w - 0.36, h: 0.32, fontSize: 13, bold: true, color: tcolor });
  if (body) T(s, { text: body, x: x + 0.18, y: y + 0.48, w: w - 0.36, h: h - 0.55, fontSize: 11.5, color: bcolor });
}
const tbl = (rows, opts) => rows.map((r, i) => r.map((c) => (typeof c === "object" ? c : { text: c, options: { fontFace: FONT, fontSize: opts.fs || 12, color: INK, fill: { color: i === 0 ? (opts.headFill || INK) : WHITE }, bold: i === 0, ...(i === 0 ? { color: WHITE } : {}), valign: "middle" } })));

// ───────── 1. 표지
{
  const s = pres.addSlide();
  s.background = { color: INK };
  T(s, { text: "2026 대한민국 청년 CAREER FAIR AI 해커톤", x: 0.8, y: 0.6, w: 8, h: 0.35, fontSize: 13, bold: true, color: AC2 });
  T(s, { text: "My News", x: 0.8, y: 1.9, w: 7, h: 1.2, fontSize: 66, bold: true, color: WHITE });
  T(s, { text: "나만의 소식통", x: 0.8, y: 3.05, w: 7, h: 0.6, fontSize: 28, bold: true, color: AC2 });
  T(s, { text: "질문 몇 개로 조건을 저장하면\n주거·채용·지원금 공고를 대신 찾아 알려 주는 AI 에이전트", x: 0.8, y: 3.95, w: 7.2, h: 1.0, fontSize: 18, color: "D5D7E0", lineSpacingMultiple: 1.2 });
  const rows = [["팀명", "마이뉴스"], ["대표자", "김유강"], ["팀원", "-"], ["제출일", "2026. 11. 23."]];
  rows.forEach((r, i) => {
    T(s, { text: r[0], x: 0.8 + i * 1.75, y: 6.15, w: 1.6, h: 0.3, fontSize: 11, color: AC2, bold: true });
    T(s, { text: r[1], x: 0.8 + i * 1.75, y: 6.45, w: 1.6, h: 0.35, fontSize: 14, color: WHITE });
  });
  phone(s, "s_home.png", 8.6, 0.9, 2.0);
  phone(s, "s_result.png", 10.85, 1.6, 2.0);
}

// ───────── 2. 프로젝트 요약
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "SUMMARY", "프로젝트 요약");
  card(s, 0.6, 1.6, 12.13, 0.85, INK);
  T(s, { text: [{ text: "한 줄 요약   ", options: { color: AC2, bold: true } }, { text: "질문 몇 개로 조건 저장 → 위치·지도로 확인 → 새 공고 알림까지, 청년 공고 탐색을 하나로 잇는 소식통", options: { color: WHITE } }], x: 0.9, y: 1.6, w: 11.6, h: 0.85, fontSize: 16, valign: "middle" });
  const cards = [
    ["1  문제", "흩어진 공고, 끝없는 확인", "주거·채용·지원금이 기관별 사이트에 분산\n맞는 공고가 언제 올지 몰라 매일 직접 확인"],
    ["2  해결 방안", "질문 → 지도 → 알림", "AI가 만드는 질문으로 내 조건 저장\n새 공고·마감 임박만 골라 알림"],
    ["3  구현 현황", "앱처럼 설치되는 웹(PWA)", "설치·가입 없이 브라우저에서 바로 시작\n새 공고 푸시 알림 · 공공데이터 11종 · 공고 약 5,700건"],
  ];
  cards.forEach((c, i) => {
    const x = 0.6 + i * 4.13;
    card(s, x, 2.75, 3.87, 2.9);
    tag(s, c[0], x + 0.3, 3.0);
    T(s, { text: c[1], x: x + 0.3, y: 3.45, w: 3.3, h: 0.4, fontSize: 16, bold: true, color: INK });
    T(s, { text: c[2], x: x + 0.3, y: 3.95, w: 3.35, h: 1.4, fontSize: 13, color: SUB, lineSpacingMultiple: 1.25 });
  });
  T(s, { text: [{ text: "키워드   ", options: { bold: true, color: INK } }, { text: "청년 공고 · 공공데이터 · AI 질문 생성 · 위치 기반 · 반복 조사 · 푸시 알림", options: { color: SUB } }], x: 0.6, y: 6.0, w: 12, h: 0.4, fontSize: 14 });
}

// ───────── 3. 01 문제 정의 ① 수요와 탐색의 어려움
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "01  문제 정의", "청년 공고 수요와 탐색의 어려움");
  T(s, { text: "청년이 가장 필요로 하는 정책 분야", x: 0.6, y: 1.6, w: 6, h: 0.35, fontSize: 15, bold: true, color: INK });
  s.addChart(pres.charts.BAR, [{ name: "응답 비율(%)", labels: ["주거", "일자리", "복지·문화", "교육"], values: [45.7, 33.5, 14.1, 5.5] }], {
    x: 0.5, y: 1.95, w: 6.1, h: 3.6, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [AC], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0\"%\"", dataLabelFontSize: 13, dataLabelColor: INK, dataLabelFontFace: FONT,
    catAxisLabelFontSize: 13, catAxisLabelColor: INK, catAxisLabelFontFace: FONT, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, valAxisMaxVal: 55, barGapWidthPct: 60,
  });
  src(s, "출처: 국무조정실 「2024 청년의 삶 실태조사」(만 19~34세, 약 1만5천 가구, 2025.3.11 발표)\n이투데이 2025.3.11 보도 — 수치를 직접 차트로 재구성", 0.6, 5.6, 6, 0.5);
  T(s, { text: "청년정책을 이용하지 않은 이유", x: 7.1, y: 1.6, w: 5.6, h: 0.35, fontSize: 15, bold: true, color: INK });
  s.addChart(pres.charts.BAR, [{ name: "응답 비율(%)", labels: ["신청 조건이 대부분\n해당되지 않아서", "관심은 있지만 어떻게\n찾아야 할지 몰라서"], values: [54.9, 39.3] }], {
    x: 7.0, y: 1.95, w: 5.8, h: 2.3, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [AC], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0\"%\"", dataLabelFontSize: 13, dataLabelColor: INK, dataLabelFontFace: FONT,
    catAxisLabelFontSize: 11, catAxisLabelColor: INK, catAxisLabelFontFace: FONT, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, valAxisMaxVal: 70, barGapWidthPct: 50,
  });
  src(s, "출처: 청년데이터연구소 청년 281명 인식 조사, 아시아경제 2026.9.18 보도", 7.1, 4.25, 5.6, 0.3);
  card(s, 7.1, 4.75, 5.63, 1.6, ACL);
  T(s, { text: "핵심 문제", x: 7.35, y: 4.9, w: 5, h: 0.32, fontSize: 14, bold: true, color: AC });
  T(s, { text: "수요는 크지만 공고는 기관마다 흩어져 있음\n'조건이 맞는지'와 '어디서 찾는지'를 청년이 직접 해결", x: 7.35, y: 5.25, w: 5.2, h: 0.95, fontSize: 13, color: INK, lineSpacingMultiple: 1.2 });
}

// ───────── 4. 01 문제 정의 ② 지속성
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "01  문제 정의", "언제 올지 모르는 기회, 지치는 확인");
  T(s, { text: "공고 지원은 꾸준히 확인하다가 언제 올지 모르는 기회를 잡는 일 — 그 확인 과정이 길고 지침", x: 0.6, y: 1.45, w: 12.1, h: 0.4, fontSize: 15, color: SUB });
  const stats = [
    ["84.5%", "구직 정보 수집에 어려움을 느낌", "가장 큰 이유: 어떤 정보를 준비해야 하는지 몰라서 38.4%", "잡코리아 MZ세대 구직자 576명 설문, 베리타스알파 2022.2.18"],
    ["71만 명", "막연히 쉬는 20·30대 청년(2025)", "장기화하면 노동시장 이탈 우려", "국가데이터처 고용동향 기반, 뉴스1 보도"],
  ];
  stats.forEach((st, i) => {
    const y = 2.1 + i * 2.25;
    card(s, 0.6, y, 5.9, 2.0);
    T(s, { text: st[0], x: 0.9, y: y + 0.2, w: 3, h: 0.9, fontSize: 44, bold: true, color: AC });
    T(s, { text: st[1], x: 0.9, y: y + 1.05, w: 5.4, h: 0.35, fontSize: 14, bold: true, color: INK });
    T(s, { text: st[2], x: 0.9, y: y + 1.38, w: 5.4, h: 0.3, fontSize: 12, color: SUB });
    src(s, "출처: " + st[3], 0.9, y + 1.68, 5.4, 0.28);
  });
  T(s, { text: "Before · 내 조건에 맞는 공고를 놓치는 과정", x: 6.9, y: 2.1, w: 5.8, h: 0.35, fontSize: 15, bold: true, color: INK });
  const before = ["LH·잡알리오·정부24를 따로 찾아봄", "조건이 맞는지 바로 알 수 없음", "언제 올라올지 몰라 확인 시점을 놓침", "마감 뒤에야 맞는 공고를 발견"];
  before.forEach((b, i) => {
    const y = 2.6 + i * 0.85;
    card(s, 6.9, y, 5.83, 0.68, i === 3 ? "FDECEC" : BG);
    T(s, { text: String(i + 1), x: 7.1, y: y + 0.17, w: 0.35, h: 0.35, fontSize: 14, bold: true, color: i === 3 ? "C0392B" : AC });
    T(s, { text: b, x: 7.5, y: y + 0.17, w: 5.1, h: 0.35, fontSize: 13.5, color: INK });
  });
  card(s, 6.9, 6.05, 5.83, 0.65, INK);
  T(s, { text: "→ 확인을 대신해 주는 도구가 필요", x: 7.1, y: 6.05, w: 5.5, h: 0.65, fontSize: 15, bold: true, color: WHITE, valign: "middle" });
}

// ───────── 5. 02 대상 사용자
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "02", "대상 사용자");
  card(s, 0.6, 1.6, 5.9, 1.45); tag(s, "주요 사용자", 0.85, 1.78);
  T(s, { text: "독립·취업을 준비하는 19~34세 청년", x: 0.85, y: 2.2, w: 5.5, h: 0.35, fontSize: 14, bold: true, color: INK });
  T(s, { text: "주거·채용·지원금을 함께 찾고 여러 사이트를 매일 확인하는 사람", x: 0.85, y: 2.58, w: 5.5, h: 0.4, fontSize: 12.5, color: SUB });
  card(s, 0.6, 3.2, 5.9, 1.2); tag(s, "보조 사용자", 0.85, 3.38);
  T(s, { text: "청년센터·대학 취업지원 상담사 — 상담 전 조건 정리·공고 근거 공유", x: 0.85, y: 3.8, w: 5.5, h: 0.4, fontSize: 12.5, color: SUB });
  card(s, 0.6, 4.55, 5.9, 2.1, ACL);
  T(s, { text: "사용자가 얻는 가치", x: 0.85, y: 4.7, w: 5, h: 0.32, fontSize: 14, bold: true, color: AC });
  T(s, { text: [
    { text: "탐색 시간 절감  ", options: { bold: true, color: INK } }, { text: "조건 저장 후 새 공고만 수신", options: { color: SUB, breakLine: true } },
    { text: "판단 근거  ", options: { bold: true, color: INK } }, { text: "맞는 이유·확인 필요 조건 표시", options: { color: SUB, breakLine: true } },
    { text: "신청 연결  ", options: { bold: true, color: INK } }, { text: "요약·신청 방법·신청 페이지 바로가기", options: { color: SUB } },
  ], x: 0.85, y: 5.1, w: 5.5, h: 1.4, fontSize: 13, paraSpaceAfter: 6 });
  T(s, { text: "After · My News 사용 시나리오 (취업 준비생 A, 서울 26세)", x: 6.9, y: 1.6, w: 5.9, h: 0.35, fontSize: 14, bold: true, color: INK });
  const steps = ["분야 2개 선택 · 내 위치 반경 10km", "AI 질문에 답하면 후보가 좁혀짐", "지도 핀·카드 요약 확인 → 신청 페이지 이동", "'이 조건으로 알림 받기' 저장", "새 공고·마감 D-3만 푸시로 수신 (목표 흐름)"];
  steps.forEach((t, i) => {
    const y = 2.1 + i * 0.9;
    s.addShape(pres.shapes.OVAL, { x: 6.95, y: y + 0.08, w: 0.5, h: 0.5, fill: { color: AC }, line: { color: AC } });
    T(s, { text: String(i + 1), x: 6.95, y: y + 0.08, w: 0.5, h: 0.5, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle" });
    if (i < 4) s.addShape(pres.shapes.LINE, { x: 7.2, y: y + 0.6, w: 0, h: 0.38, line: { color: "C7CBE0", width: 2 } });
    card(s, 7.65, y, 5.08, 0.66, BG);
    T(s, { text: t, x: 7.85, y: y, w: 4.8, h: 0.66, fontSize: 13, color: INK, valign: "middle" });
  });
  src(s, "맞는 공고가 있었는데 몰라서 놓침 → 조건을 한 번 저장하면 새 공고가 먼저 찾아옴", 6.9, 6.62, 5.9, 0.3);
}

// ───────── 6. 03 AI를 활용한 해결 방안
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "03", "AI를 활용한 해결 방안");
  T(s, { text: "왜 AI인가 — 기관마다 자격 문구가 제각각(\"무주택 세대구성원\", \"기준중위소득 100% 이하\")이라 규칙만으로 수천 건 정리 불가", x: 0.6, y: 1.4, w: 8.2, h: 0.55, fontSize: 12.5, color: SUB });
  const H = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 12, bold: true, color: WHITE, fill: { color: INK }, valign: "middle" } });
  const C = (t, b) => ({ text: t, options: { fontFace: FONT, fontSize: 11, color: INK, bold: !!b, fill: { color: WHITE }, valign: "middle" } });
  s.addTable([
    [H("사용자 단계"), H("AI 입력"), H("AI 출력 → 활용")],
    [C("① 공고 수집 때\n자격 조건 구조화", true), C("공고 원문(최대 4,000자)"), C("나이·지역·무주택·소득 조건 목록\n→ 카드마다 맞음·확인 필요 판정")],
    [C("② Jev를 통한\n공고 적합성 평가", true), C("웹 검색 결과 제목·요약"), C("'지원 가능한 개별 모집 공고인가' 확률\n→ 0.5 미만 안내·목록 페이지 제외")],
    [C("③ 질문 단계\n다음 질문 생성", true), C("지금까지 답변 + 남은 공고 차이"), C("질문 문장·선택지·필요한 이유\n→ 남은 공고를 가장 잘 나누는 질문")],
    [C("④ 결과 단계\n요약·주소 추출", true), C("공고 원문"), C("한 줄 요약·신청 방법·근무지 주소\n→ 카드 요약과 지도 핀")],
  ], { x: 0.6, y: 2.0, w: 8.2, colW: [1.9, 2.4, 3.9], rowH: [0.42, 0.78, 0.78, 0.78, 0.78], border: { type: "solid", pt: 0.75, color: LINE } });
  card(s, 0.6, 5.7, 8.2, 1.0, ACL);
  T(s, { text: [
    { text: "생성형 AI  ", options: { bold: true, color: AC } }, { text: "Groq → OpenRouter → Cloudflare → Gemini → Anthropic (한도·실패 시 다음, 모두 실패 시 규칙 판정)", options: { color: INK, breakLine: true } },
    { text: "판단 AI  ", options: { bold: true, color: AC } }, { text: "Jev — 공고 적합성 평가 · 한 번 분석한 공고는 저장해 재사용(빠른 결과, 무료 한도 절약)", options: { color: INK } },
  ], x: 0.85, y: 5.78, w: 7.8, h: 0.85, fontSize: 11.5, paraSpaceAfter: 4 });
  phone(s, "s_ai_q.png", 9.85, 1.55, 2.15, "③ AI가 공고 차이로 만든 질문");
}

// ───────── 7. 04 서비스 구조
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "04", "서비스 구조");
  T(s, { text: "기술 스택", x: 0.6, y: 1.5, w: 4, h: 0.35, fontSize: 15, bold: true, color: INK });
  const K = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 11, bold: true, color: SUB, fill: { color: BG }, valign: "middle" } });
  const V = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 10.5, color: INK, fill: { color: WHITE }, valign: "middle" } });
  s.addTable([
    [K("프론트"), V("Next.js 15 · React 19 · Tailwind 4 · 앱처럼 설치되는 웹(PWA) · 카카오 지도(대체 Leaflet)")],
    [K("백엔드"), V("Next.js API — 공고 수집·질문 생성·요약·알림 저장·발송")],
    [K("AI 모델"), V("Groq(gpt-oss-120b) · OpenRouter · Cloudflare · Gemini · Anthropic, 공고 적합성 평가 Jev")],
    [K("외부 API"), V("공공 API 11종(LH·마이홈·청약홈·잡알리오·정부24·온통청년·고용24 3종·서울시 채용·Q-Net), 카카오, Tavily·Exa")],
    [K("데이터"), V("공공데이터포털·기관 이용조건, 지도 © 카카오 / OpenStreetMap(ODbL)")],
    [K("배포"), V("Vercel · Upstash Redis · Web Push · GitHub Actions(15분 주기)")],
  ], { x: 0.6, y: 1.9, w: 5.6, colW: [1.1, 4.5], rowH: 0.7, border: { type: "solid", pt: 0.75, color: LINE } });
  T(s, { text: "서비스 구조도", x: 6.6, y: 1.5, w: 4, h: 0.35, fontSize: 15, bold: true, color: INK });
  // 출처
  card(s, 6.6, 1.9, 6.13, 0.85, BG);
  T(s, { text: "공공 API 11종", x: 6.8, y: 1.98, w: 3, h: 0.3, fontSize: 11, bold: true, color: SUB });
  T(s, { text: "주거 LH·마이홈·청약홈 | 일자리 잡알리오·고용24·서울시 | 지원 정부24·온통청년 | 자격 Q-Net", x: 6.8, y: 2.28, w: 5.8, h: 0.4, fontSize: 10.5, bold: true, color: INK });
  arrow(s, 9.66, 2.78, 9.66, 3.08);
  box(s, 6.6, 3.1, 6.13, 0.9, "① 공고 풀 수집 (15분 주기)", "중복 제거 · AI 조건 구조화 → 약 5,700건 저장(Upstash)", INK, AC2, WHITE);
  arrow(s, 8.0, 4.03, 8.0, 4.33); arrow(s, 11.3, 4.03, 11.3, 4.33);
  box(s, 6.6, 4.35, 2.95, 1.25, "② 사용자 화면", "저장된 공고 풀에서 바로 조회\nAI 질문 · 지도 · 카드 · 분석");
  box(s, 9.78, 4.35, 2.95, 1.25, "③ 반복 조사", "저장 조건마다 공고 풀 재대조\n새 공고 · 마감 D-3 추출");
  arrow(s, 9.55, 4.97, 9.76, 4.97);
  arrow(s, 11.25, 5.63, 11.25, 5.9);
  box(s, 9.78, 5.92, 2.95, 0.72, "Web Push 알림", null, WHITE, AC);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.78, y: 5.92, w: 2.95, h: 0.72, fill: { type: "none" }, line: { color: AC, width: 1.5 }, rectRadius: 0.12 });
  T(s, { text: "④ 보충: 웹 검색(Tavily→Exa) → Jev 적합성 평가 (기본 꺼짐)", x: 6.6, y: 5.75, w: 3.0, h: 0.6, fontSize: 10, color: SUB });
  src(s, "저장 정보: 조건 · 위치(약 1km 반올림) · 푸시 구독 · 소유자 확인용 해시 · 조회 기록", 0.6, 6.25, 5.6, 0.3);
}

// ───────── 8. 05 핵심 기능 및 사용자 흐름
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "05", "핵심 기능 및 사용자 흐름");
  const feats = [["s_q0.png", "기능 1  위치 기반 탐색", "GPS·주소·지도로 위치, 1~10km 반경"], ["s_ai_q.png", "기능 2  AI 질문으로 좁히기", "답할 때마다 AI가 다음 질문 생성"], ["s_result.png", "기능 3  결과 조정·반복 알림", "지도 핀↔카드, 조건 저장 시 새 공고 알림"]];
  feats.forEach((f, i) => {
    const x = 0.75 + i * 2.55;
    phone(s, f[0], x, 1.55, 1.75);
    T(s, { text: f[1], x: x - 0.3, y: 5.5, w: 2.45, h: 0.3, fontSize: 11.5, bold: true, color: INK, align: "center" });
    T(s, { text: f[2], x: x - 0.3, y: 5.8, w: 2.45, h: 0.5, fontSize: 10, color: SUB, align: "center" });
  });
  T(s, { text: "Happy Path + 결과 조정", x: 8.4, y: 1.55, w: 4.3, h: 0.35, fontSize: 15, bold: true, color: INK });
  const flow = ["분야 선택", "위치·반경", "AI 질문 답변", "지도·카드 결과", "결과 조정", "조건 저장", "새 공고 푸시*"];
  flow.forEach((f, i) => {
    const y = 2.0 + i * 0.62;
    const hl = i === 4, last = i === 6;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.4, y, w: 2.2, h: 0.46, fill: { color: last ? AC : hl ? "FFF4E5" : ACL }, line: { color: hl ? WARN : last ? AC : ACL, width: hl ? 1.5 : 0.75 }, rectRadius: 0.23 });
    T(s, { text: f, x: 8.4, y, w: 2.2, h: 0.46, fontSize: 12, bold: true, color: last ? WHITE : hl ? WARN : INK, align: "center", valign: "middle" });
    if (i < 6) arrow(s, 9.5, y + 0.47, 9.5, y + 0.61);
  });
  card(s, 10.8, 4.05, 1.93, 1.45, "FFF4E5");
  T(s, { text: [
    { text: "많으면  ", options: { bold: true, color: WARN } }, { text: "추가 질문으로 더 좁히기", options: { color: INK, breakLine: true } },
    { text: "적으면  ", options: { bold: true, color: WARN } }, { text: "반경 넓히기·조건 풀기", options: { color: INK } },
  ], x: 10.9, y: 4.12, w: 1.75, h: 1.3, fontSize: 10, paraSpaceAfter: 4 });
  arrow(s, 10.62, 4.71, 10.79, 4.71, WARN);
  src(s, "* 서버 재조사·푸시는 로컬에서 확인, 운영 환경 실측 진행 중", 8.4, 6.42, 4.3, 0.3);
}

// ───────── 9. 06 차별점
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "06", "차별점 — 정보의 깊이보다 편의성과 연결");
  const H = (t, hl) => ({ text: t, options: { fontFace: FONT, fontSize: 12, bold: true, color: WHITE, fill: { color: hl ? AC : INK }, valign: "middle" } });
  const K = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 11.5, bold: true, color: SUB, fill: { color: BG }, valign: "middle" } });
  const V = (t, hl) => ({ text: t, options: { fontFace: FONT, fontSize: 11.5, color: INK, bold: !!hl, fill: { color: hl ? ACL : WHITE }, valign: "middle" } });
  s.addTable([
    [H("비교"), H("사람인·잡코리아\n알바몬·알바천국"), H("정책 알림\n혜택알리미·웰로"), H("기관 알리미\nLH·잡알리오"), H("My News", true)],
    [K("강점"), V("공고 양·상세 정보"), V("지원금 추천"), V("해당 기관 공고 정확"), V("분야를 넘나드는 간편함", true)],
    [K("시작 방법"), V("앱 설치·회원가입·이력 입력"), V("가입·본인 정보 입력"), V("기관별 가입"), V("설치·가입 없이 질문 몇 개", true)],
    [K("범위"), V("채용 또는 알바 하나"), V("지원금 중심"), V("한 기관·한 분야"), V("주거·채용·알바·지원금·국비·자격증", true)],
    [K("알림"), V("사이트별로 따로 설정"), V("추천·마감 안내"), V("기관별 설정"), V("조건 한 번 저장으로 전체 감시", true)],
  ], { x: 0.6, y: 1.6, w: 12.13, colW: [1.5, 2.6, 2.4, 2.4, 3.23], rowH: [0.72, 0.62, 0.62, 0.62, 0.62], border: { type: "solid", pt: 0.75, color: LINE } });
  card(s, 0.6, 5.1, 12.13, 1.2, INK);
  T(s, { text: [
    { text: "공고의 깊이는 전문 사이트가 낫다. ", options: { color: "D5D7E0" } },
    { text: "My News는 그 사이트들을 매일 돌아보는 수고를 대신해, 맞는 공고가 생겼을 때 먼저 알려 준다.", options: { color: WHITE, bold: true } },
  ], x: 0.9, y: 5.1, w: 11.6, h: 1.2, fontSize: 15, valign: "middle" });
  src(s, "비교 근거: 각 서비스 공개 화면 기준 조사(2026.11.21, docs/market_research.md). 아이폰은 푸시 수신 시 홈 화면 추가 필요", 0.6, 6.45, 12, 0.3);
}

// ───────── 10. 07 구현 현황 및 프로토타입
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "07", "구현 현황 및 프로토타입");
  [["s_result2.png", "카드 요약·신청 안내"], ["s_analysis.png", "걸러진 이유·기회 분석"], ["s_alerts.png", "알림 화면"]].forEach((p, i) => phone(s, p[0], 0.75 + i * 2.35, 1.6, 1.85, p[1]));
  [["11종", "연결한 공공데이터"], ["5,700", "모은 공고(건, 약)"], ["180", "자동 검사 통과"]].forEach((st, i) => {
    const x = 7.9 + i * 1.62;
    card(s, x, 1.6, 1.5, 1.25, ACL);
    T(s, { text: st[0], x, y: 1.7, w: 1.5, h: 0.6, fontSize: 24, bold: true, color: AC, align: "center" });
    T(s, { text: st[1], x, y: 2.32, w: 1.5, h: 0.4, fontSize: 10, color: SUB, align: "center" });
  });
  card(s, 7.9, 3.0, 4.83, 2.7, BG);
  T(s, { text: "완성된 기능", x: 8.1, y: 3.1, w: 4, h: 0.32, fontSize: 13, bold: true, color: INK });
  const done = ["위치로 찾기 — 거리 1~10km, 지도 핀 표시", "AI 질문 생성·추가 질문으로 좁히기", "결과 조정 — 반경 넓히기·조건 풀기", "공고 카드 — 요약·신청 방법·바로가기", "걸러진 이유 보기 — 질문별 빠진 공고", "새 공고·마감 임박 알림, AI 다중 대체"];
  T(s, { text: done.map((d, i) => ({ text: d, options: { bullet: true, breakLine: i < done.length - 1 } })), x: 8.1, y: 3.45, w: 4.55, h: 2.2, fontSize: 11, color: INK, paraSpaceAfter: 3 });
  card(s, 7.9, 5.85, 4.83, 0.85, "FFF4E5");
  T(s, { text: [{ text: "남은 일  ", options: { bold: true, color: WARN } }, { text: "실제 서비스 환경에서 앱 종료 상태 알림 최종 확인, 최신 기능 공개 주소 반영", options: { color: INK } }], x: 8.1, y: 5.9, w: 4.5, h: 0.75, fontSize: 11, valign: "middle" });
  src(s, "수치: 2026.11.23 로컬 기준(공고 수집 01:29, 자동 검사 180개)", 0.6, 6.55, 7, 0.3);
}

// ───────── 11. 08 기대효과
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "08", "기대효과 · 한계와 극복 방안");
  [["사용자", "확인 부담 감소, D-3 알림으로 놓침 감소"], ["상담 현장", "조건·빠진 이유 정리로 상담 준비 단축"], ["공공데이터", "흩어진 공공 API를 한 조건으로 연결"]].forEach((c, i) => {
    const x = 0.6 + i * 4.13;
    card(s, x, 1.5, 3.87, 0.95, ACL);
    T(s, { text: c[0], x: x + 0.25, y: 1.6, w: 3.5, h: 0.3, fontSize: 12, bold: true, color: AC });
    T(s, { text: c[1], x: x + 0.25, y: 1.92, w: 3.5, h: 0.45, fontSize: 12, color: INK });
  });
  const H = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 11.5, bold: true, color: WHITE, fill: { color: INK }, valign: "middle" } });
  const K = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 10.5, bold: true, color: INK, fill: { color: BG }, valign: "middle" } });
  const V = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 10.5, color: INK, fill: { color: WHITE }, valign: "middle" } });
  s.addTable([
    [H("현재 한계"), H("극복 방안"), H("기대효과")],
    [K("공고 데이터 품질 — 기관마다 항목이 다르고 민간 채용·알바는 공개 API 없음"), V("사람인·잡코리아 등 기업형 채용 API 제휴, 고용24 기관 회원 등록"), V("민간 채용 수만 건 확보, 조건 정보가 채워진 공고 비율 상승")],
    [K("속도·안정성 — 외부 API 상태에 따라 수집 실패·지연"), V("별도 DB 서버로 공고를 정규화 저장, 변경분만 갱신"), V("외부 장애와 무관한 빠른 조회, 데이터 이력 관리")],
    [K("지도 위치 정확도 — 주소가 없으면 시·군 중심에 핀"), V("DB에 공고별 세부 좌표(근무지·접수처·단지) 저장·검수"), V("핀 정확도와 거리 기반 추천 신뢰도 향상")],
    [K("요약·정보 표기 품질 — 첨부파일에만 내용이 있으면 부정확"), V("원문·첨부를 DB에 저장, 검증된 요약을 공고 단위로 고정"), V("카드 요약·신청 방법 품질 향상, AI 비용 감소")],
    [K("AI 판정 정확도 — 무료 AI 해석 오류 가능(현재 '확인 필요' 표시)"), V("표본 공고 검수로 정확도 측정, 자주 틀리는 문구는 규칙 보완"), V("판정 신뢰도를 수치로 제시")],
  ], { x: 0.6, y: 2.65, w: 12.13, colW: [4.4, 4.0, 3.73], rowH: [0.38, 0.56, 0.5, 0.5, 0.5, 0.5], border: { type: "solid", pt: 0.75, color: LINE } });
  T(s, { text: [
    { text: "확장 로드맵  ", options: { bold: true, color: AC } }, { text: "① 고용24 기관 회원 + 자체 DB → ② 민간 채용·알바 제휴 → ③ 지자체·대학 공고 개방 요청 → ④ 기업·기관 직접 등록", options: { color: INK, breakLine: true } },
    { text: "측정 계획  ", options: { bold: true, color: AC } }, { text: "알림 클릭률 · 신청 페이지 이동 수 · 재방문율 · 판정 정확도(표본 검수)", options: { color: INK } },
  ], x: 0.6, y: 6.15, w: 12.13, h: 0.7, fontSize: 11.5, paraSpaceAfter: 3 });
}

// ───────── 12. 별첨 1
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "별첨", "팀 구성 및 사전 개발 내역 고지");
  const H = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 13, bold: true, color: WHITE, fill: { color: INK }, valign: "middle" } });
  const V = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 13, color: INK, fill: { color: WHITE }, valign: "middle" } });
  const K = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 13, bold: true, color: SUB, fill: { color: BG }, valign: "middle" } });
  T(s, { text: "팀 구성 및 역할", x: 0.6, y: 1.6, w: 5, h: 0.35, fontSize: 15, bold: true, color: INK });
  s.addTable([[H("이름"), H("역할"), H("담당 업무")], [V("김유강"), V("대표자"), V("기획, 개발")]], { x: 0.6, y: 2.0, w: 5.6, colW: [1.6, 1.4, 2.6], rowH: 0.5, border: { type: "solid", pt: 0.75, color: LINE } });
  T(s, { text: "기존 개발물 · 사전 개발 내역", x: 6.8, y: 1.6, w: 5.9, h: 0.35, fontSize: 15, bold: true, color: INK });
  s.addTable([
    [H("구분"), H("내용")],
    [K("해커톤 이전 개발 범위"), V("해당 없음")],
    [K("해커톤 기간 중 개발 범위"), V("기획, 앱 전체(공고 수집, AI 질문, 지도, 알림, AI 연동)")],
    [K("타 공모전 출품·수상 여부"), V("해당 없음")],
  ], { x: 6.8, y: 2.0, w: 5.93, colW: [2.3, 3.63], rowH: [0.5, 0.55, 0.75, 0.55], border: { type: "solid", pt: 0.75, color: LINE } });
  card(s, 0.6, 4.9, 12.13, 1.1, ACL);
  T(s, { text: "AI와 팀의 역할 및 검증 과정은 홈페이지 「AI 활용내역」에 작성. 개발 보조 도구(Claude Code, OpenAI Codex)는 서로의 결과물을 교차 검토하는 방식으로 사용", x: 0.85, y: 4.9, w: 11.6, h: 1.1, fontSize: 13, color: INK, valign: "middle" });
}

// ───────── 13. 별첨 2
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  head(s, "별첨", "활용한 외부 자원 · 출처");
  const H = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 10.5, bold: true, color: WHITE, fill: { color: INK }, valign: "middle" } });
  const V = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 9.5, color: INK, fill: { color: WHITE }, valign: "middle" } });
  const K = (t) => ({ text: t, options: { fontFace: FONT, fontSize: 9.5, bold: true, color: SUB, fill: { color: BG }, valign: "middle" } });
  const rows = [
    ["오픈소스", "Next.js · React · Tailwind CSS", "MIT", "앱 화면·서버"],
    ["오픈소스", "Leaflet / web-push / Anthropic SDK", "BSD-2-Clause / MPL-2.0 / Apache-2.0", "대체 지도 / 알림 / AI 호출"],
    ["외부 데이터·API", "LH · 마이홈 · 청약홈", "공공데이터포털 이용허락 범위", "주거 공고"],
    ["외부 데이터·API", "잡알리오 · 고용24(국비훈련·공채속보·채용행사) · 서울시 채용", "공공데이터포털·각 기관 이용조건", "채용·알바·국비 공고"],
    ["외부 데이터·API", "정부24 · 온통청년 · Q-Net", "공공데이터포털·온통청년 이용조건", "지원금·청년정책·자격증"],
    ["지도", "카카오 지도·주소 검색 / OpenStreetMap", "카카오 이용약관 / ODbL", "지도·위치"],
    ["웹 검색", "Tavily · Exa", "각 서비스 이용약관", "공고 보충(기본 꺼짐)"],
    ["AI 모델", "Groq · OpenRouter · Cloudflare Workers AI · Gemini · Anthropic", "각 제공사 이용약관", "조건 구조화·질문·요약"],
    ["AI 모델", "Jev(TypeSafe)", "제공사 이용약관", "공고 적합성 평가"],
    ["인프라", "Vercel · Upstash Redis · GitHub Actions", "각 서비스 약관", "배포·저장·주기 실행"],
    ["개발 도구", "Claude Code · OpenAI Codex", "각 제공사 약관", "코드·문서 작성 보조"],
    ["통계·기사", "국무조정실 「2024 청년의 삶 실태조사」(이투데이), 청년데이터연구소 조사(아시아경제), 잡코리아 설문(베리타스알파), 뉴스1", "각 원문 링크", "01 문제 정의"],
  ];
  s.addTable([[H("구분"), H("명칭"), H("출처·라이선스"), H("사용 위치")], ...rows.map((r) => [K(r[0]), V(r[1]), V(r[2]), V(r[3])])],
    { x: 0.6, y: 1.5, w: 12.13, colW: [1.6, 5.0, 3.33, 2.2], rowH: 0.36, border: { type: "solid", pt: 0.75, color: LINE } });
}

pres.writeFile({ fileName: OUT }).then((f) => console.log("written", f));
