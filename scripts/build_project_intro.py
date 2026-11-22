from pathlib import Path
from textwrap import wrap

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "찾아줄게_프로젝트소개서_20261122.pdf"
W, H = landscape(A4)

NAVY = HexColor("#17233C")
BLUE = HexColor("#3768F4")
CYAN = HexColor("#38BDF8")
MINT = HexColor("#2DD4BF")
ORANGE = HexColor("#FB923C")
RED = HexColor("#EF5B5B")
INK = HexColor("#1E293B")
SUB = HexColor("#64748B")
LINE = HexColor("#DCE4F2")
PALE = HexColor("#F5F8FF")
PALE2 = HexColor("#ECFEFF")


def register_fonts():
    fonts = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont("K", str(fonts / "malgun.ttf")))
    pdfmetrics.registerFont(TTFont("KB", str(fonts / "malgunbd.ttf")))


def text(c, x, y, s, size=10, color=INK, font="K", max_width=None, leading=None):
    c.setFillColor(color)
    c.setFont(font, size)
    leading = leading or size * 1.45
    lines = []
    for para in str(s).split("\n"):
        if not max_width:
            lines.append(para)
            continue
        words = list(para)
        line = ""
        for ch in words:
            test = line + ch
            if pdfmetrics.stringWidth(test, font, size) <= max_width:
                line = test
            else:
                lines.append(line)
                line = ch
        lines.append(line)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def centered(c, x, y, s, size=10, color=INK, font="K"):
    c.setFillColor(color); c.setFont(font, size); c.drawCentredString(x, y, s)


def box(c, x, y, w, h, fill=white, stroke=LINE, radius=10, width=1):
    c.setLineWidth(width); c.setStrokeColor(stroke); c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def pill(c, x, y, label, color=BLUE, fg=white, size=8):
    w = pdfmetrics.stringWidth(label, "KB", size) + 18
    c.setFillColor(color); c.roundRect(x, y, w, 19, 9, stroke=0, fill=1)
    centered(c, x + w / 2, y + 5.3, label, size, fg, "KB")
    return w


def header(c, num, title, subtitle=None):
    c.setFillColor(NAVY); c.rect(0, H - 74, W, 74, stroke=0, fill=1)
    centered(c, 38, H - 48, num, 13, white, "KB")
    text(c, 70, H - 43, title, 21, white, "KB")
    if subtitle: text(c, 70, H - 61, subtitle, 8.2, HexColor("#BFDBFE"), "K")


def footer(c, page, source=None):
    c.setStrokeColor(LINE); c.line(34, 26, W - 34, 26)
    text(c, 34, 11, source or "2026 대한민국 청년 CAREER FAIR AI 해커톤 | 찾아줄게", 6.8, SUB)
    c.setFillColor(SUB); c.setFont("KB", 7); c.drawRightString(W - 34, 11, str(page))


def arrow(c, x1, y1, x2, y2, color=BLUE, width=2):
    c.setStrokeColor(color); c.setFillColor(color); c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    import math
    a = math.atan2(y2-y1, x2-x1)
    r = 6
    pts = [(x2, y2), (x2-r*math.cos(a-.55), y2-r*math.sin(a-.55)), (x2-r*math.cos(a+.55), y2-r*math.sin(a+.55))]
    p = c.beginPath(); p.moveTo(*pts[0]); p.lineTo(*pts[1]); p.lineTo(*pts[2]); p.close()
    c.drawPath(p, stroke=0, fill=1)


def stat_bar(c, x, y, label, value, color, width=225):
    text(c, x, y + 9, label, 9, INK, "KB")
    text(c, x + width + 12, y + 9, f"{value:.1f}%", 11, color, "KB")
    c.setFillColor(HexColor("#E8EEF8")); c.roundRect(x, y - 10, width, 12, 6, stroke=0, fill=1)
    c.setFillColor(color); c.roundRect(x, y - 10, width * value / 100, 12, 6, stroke=0, fill=1)


def add_cover(c):
    c.setFillColor(NAVY); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(BLUE); c.circle(W-80, H-40, 150, stroke=0, fill=1)
    c.setFillColor(CYAN); c.circle(W-25, 50, 95, stroke=0, fill=1)
    pill(c, 54, H-82, "2026 대한민국 청년 CAREER FAIR AI 해커톤", CYAN, NAVY, 8)
    text(c, 54, H-174, "찾아줄게", 42, white, "KB")
    text(c, 56, H-220, "질문 몇 개로 조건을 정하면,\n청년 기회를 매일 다시 찾아 처음 보는 것만 알려주는 AI 에이전트", 17, HexColor("#DBEAFE"), "K", 560, 26)
    box(c, 54, 88, 500, 90, HexColor("#20304F"), HexColor("#3A4A69"), 14)
    text(c, 74, 147, "팀명 · 대표자 · 팀원", 8, HexColor("#94A3B8"), "KB")
    text(c, 74, 121, "[제출 전 입력 필요]", 14, white, "KB")
    text(c, 74, 99, "제출일 2026. 11. 22.", 9, HexColor("#CBD5E1"))
    c.setFillColor(white); c.setFont("KB", 8); c.drawRightString(W-48, 34, "PROJECT INTRODUCTION")
    c.showPage()


def add_summary(c):
    header(c, "", "프로젝트 요약", "한 번 정한 조건으로 여러 분야의 공고를 반복 조사")
    text(c, 42, H-110, "예·아니오·모름 게임으로 조건을 만들고, 공공 API를 매일 다시 조회해 새 공고·마감 변화만 알린다.", 14, NAVY, "KB", 750)
    cols = [("01  문제", "주거·채용·지원금 사이트가 분리되어\n같은 조건을 반복 입력하고 매일 확인해야 한다.", RED),
            ("02  해결", "최대 6개 질문 → 근거 있는 매칭 →\n저장 조건으로 매일 재조회 → 변화만 푸시", BLUE),
            ("03  구현", "PWA + 9개 어댑터 + 규칙/AI 구조화 +\n반복 조사·주간 리포트. 95개 테스트 통과", MINT)]
    for i,(t,b,col) in enumerate(cols):
        x=42+i*255; box(c,x,H-275,235,120,white,LINE,12)
        pill(c,x+16,H-188,t,col)
        text(c,x+16,H-215,b,10,INK,"K",203,17)
    box(c,42,90,W-84,122,PALE,HexColor("#C7D7FF"),12)
    text(c,62,183,"핵심 가치",10,BLUE,"KB")
    text(c,62,155,"1회 조건 입력",18,NAVY,"KB"); arrow(c,185,159,250,159)
    text(c,270,155,"6개 분야 통합 탐색",18,NAVY,"KB"); arrow(c,440,159,505,159)
    text(c,525,155,"새 공고·마감 변화만",18,NAVY,"KB")
    text(c,62,115,"키워드  청년 · 공공데이터 · 반복 리서치 · 자격조건 구조화 · 설명 가능한 필터링 · Web Push",9,SUB,"K")
    footer(c,2)
    c.showPage()


def add_problem(c):
    header(c,"01","문제 정의","찾아야 할 기회는 많지만, 확인 경로와 조건은 흩어져 있다")
    box(c,42,H-282,330,170,PALE,LINE,12)
    text(c,62,H-142,"청년의 실제 탐색 장면",12,NAVY,"KB")
    text(c,62,H-174,"LH·마이홈에서 주거 공고를,\n잡알리오에서 채용을, 정부24에서 혜택을\n각각 찾는다. 조건이 맞는 공고가 언제 생길지\n몰라 확인을 멈추기 어렵고, 마감 뒤에 알기도 한다.",11,INK,"K",285,20)
    text(c,62,H-258,"문제는 ‘추천이 없음’이 아니라\n분야별 탐색과 반복 확인이 사용자에게 남아 있다는 것.",9,RED,"KB",285,16)
    text(c,405,H-124,"청년이 말한 우선순위",12,NAVY,"KB")
    stat_bar(c,405,H-166,"필요한 정책: 주거",45.7,BLUE,270)
    stat_bar(c,405,H-213,"필요한 정책: 일자리",33.5,MINT,270)
    text(c,405,H-254,"2024 청년 삶 실태조사 · 만 19~34세 15,098명",7.5,SUB)
    box(c,42,82,744,134,white,LINE,12)
    text(c,62,188,"공공임대",9,SUB,"KB"); text(c,62,151,"71.7%",25,BLUE,"KB"); text(c,158,156,"거주 의향",10,INK,"KB")
    text(c,62,116,"7.0%",21,RED,"KB"); text(c,135,120,"거주 경험",10,INK,"KB")
    c.setStrokeColor(LINE); c.line(270,100,270,194)
    text(c,300,188,"정책 대상 여부가 불명확",9,SUB,"KB"); text(c,300,142,"50.5%",29,ORANGE,"KB")
    text(c,425,149,"민간 조사 · 청년 521명",9,INK)
    text(c,300,113,"※ 격차의 원인을 ‘공고 누락’으로 단정하지 않음",7.5,SUB)
    footer(c,3,"출처: 국무조정실 2024 청년 삶 실태조사 / 소셜임팩트뉴스 2026.1 민간조사")
    c.showPage()


def add_user(c):
    header(c,"02","대상 사용자","주거와 일자리를 함께 찾는 독립·독립 준비 청년")
    box(c,42,H-274,355,165,PALE,LINE,12)
    pill(c,62,H-147,"PRIMARY",BLUE)
    text(c,62,H-184,"만 19~34세 청년",19,NAVY,"KB")
    text(c,62,H-216,"특히 공공임대·채용·지원금을 동시에 찾는\n취업 준비생과 1인 가구",11,INK,"K",300,19)
    box(c,422,H-274,364,165,white,LINE,12)
    pill(c,442,H-147,"STAKEHOLDERS",MINT,NAVY)
    text(c,442,H-184,"청년센터 · 대학 취업지원 상담사",15,NAVY,"KB")
    text(c,442,H-216,"상담 전에 공통 조건을 빠르게 정리하고,\n원문 근거가 있는 후보를 함께 검토",11,INK,"K",315,19)
    text(c,42,H-316,"사용자가 얻는 가치",13,NAVY,"KB")
    vals=[("30초", "긴 양식 대신\n게임식 조건 설정"),("한 번", "여러 분야에서\n공통 프로필 재사용"),("변화만", "새 공고·마감 변경·\nD-3를 묶어 알림"),("근거", "통과·확인 필요와\n원문 조건을 함께 표시")]
    for i,(n,b) in enumerate(vals):
        x=42+i*190; box(c,x,87,172,139,white,LINE,12)
        centered(c,x+86,180,n,22,[BLUE,MINT,ORANGE,CYAN][i],"KB")
        centered(c,x+86,145,b.split("\n")[0],10,INK,"KB"); centered(c,x+86,128,b.split("\n")[1],10,INK,"KB")
    footer(c,4)
    c.showPage()


def add_ai(c):
    header(c,"03","AI를 활용한 해결 방안","AI는 문장을 구조화하고, 판정과 변화 감지는 코드가 책임진다")
    stages=[("공고 원문", "서로 다른\n자격요건 문장", NAVY), ("규칙 우선", "명시적 나이·지역·\n무주택·소득 추출", BLUE), ("Gemini 보완", "규칙이 놓친 속성만\n신뢰도와 함께 추가", MINT), ("코드 판정", "답변과 조건 비교\n통과/확인 필요", ORANGE)]
    for i,(t,b,col) in enumerate(stages):
        x=42+i*194; box(c,x,H-252,165,115,white,LINE,12); pill(c,x+14,H-174,t,col); text(c,x+14,H-202,b,9.5,INK,"K",135,16)
        if i<3: arrow(c,x+166,H-195,x+190,H-195)
    box(c,42,104,744,190,PALE,HexColor("#C7D7FF"),12)
    text(c,62,266,"왜 AI인가",11,BLUE,"KB")
    text(c,62,240,"기관마다 표현이 다른 자격요건을 공통 조건으로 바꾸려면 문맥 해석이 필요하다.",12,NAVY,"KB")
    text(c,62,211,"안전장치",10,INK,"KB")
    safeguards=["규칙 조건은 항상 유지하고 AI는 빈 속성만 보완", "청년과 무관한 0세·60세, 기관명 속 지명 등 비현실 조건 제거", "낮은 신뢰도·우대 조건·취업상태는 탈락 대신 ‘확인 필요’", "AI 해석 배지 + 원문 문장 + 최종 공고 링크 표시"]
    for i,s in enumerate(safeguards): text(c,78,186-i*22,"• "+s,9.3,INK,"K",680)
    text(c,62,117,"검증",9,SUB,"KB"); text(c,105,117,"실공고 20건 · 정답 조건 38개 → 앱 방식 정밀도 94.6%(35/37), 재현율 92.1%(35/38)",9.2,BLUE,"KB")
    footer(c,5,"모델: Gemini 3.5 Flash-Lite(조건 보완) · Jev 1.14.0(웹 검색 결과의 공고 여부 판별)")
    c.showPage()


def add_arch(c):
    header(c,"04","서비스 구조","API 수집부터 질문 필터링, 반복 조사까지 하나의 파이프라인")
    # API lane
    box(c,32,H-235,185,130,PALE2,HexColor("#A5F3FC"),12)
    text(c,48,H-130,"공공·외부 API",11,NAVY,"KB")
    apis=["주거  LH · 마이홈 · 청약홈", "채용  잡알리오 · 사람인*", "혜택  공공서비스 · 온통청년*", "교육/자격  고용24* · Q-Net", "보충  SH RSS · Exa/Tavily*"]
    for i,s in enumerate(apis): text(c,48,H-154-i*17,s,7.8,INK,"K")
    text(c,48,H-226,"* 키·설정 없으면 샘플/비활성",6.8,SUB)
    # normalize
    box(c,245,H-225,170,110,white,LINE,12)
    text(c,260,H-145,"공통 Opportunity",10,BLUE,"KB")
    text(c,260,H-169,"분야 · 기관 · 지역 · 마감\n원문 URL · 출처 · 샘플 여부",8.5,INK,"K",140,15)
    text(c,260,H-209,"출처 간 제목 기반 중복 제거",7,SUB)
    arrow(c,217,H-170,245,H-170)
    # structure
    box(c,443,H-225,165,110,white,LINE,12)
    text(c,458,H-145,"조건 구조화",10,MINT,"KB")
    text(c,458,H-169,"규칙 우선 + Gemini 보완\nage · region · homeless\nincome · employment · interest",8.2,INK,"K",138,14)
    arrow(c,415,H-170,443,H-170)
    # question
    box(c,636,H-225,170,110,white,LINE,12)
    text(c,651,H-145,"질문 엔진",10,ORANGE,"KB")
    text(c,651,H-169,"남은 후보를 가장 잘 가르는\n질문을 정보량 점수로 선택",8.5,INK,"K",140,15)
    text(c,651,H-209,"첫 질문은 관심 분야 우선",7,SUB)
    arrow(c,608,H-170,636,H-170)
    # filtering detail
    box(c,32,185,495,150,PALE,HexColor("#C7D7FF"),12)
    text(c,48,309,"질문별 필터링 규칙",10,NAVY,"KB")
    rows=[("질문 속성", "나이 · 지역 · 무주택 · 1인가구 · 소득 · 취업상태 · 관심분야"),
          ("예", "해당 값을 지식에 추가 → 모순되는 공고 제외"),
          ("아니오", "해당 값을 제외 → 하드 조건이 맞지 않는 공고 제외"),
          ("모름", "후보는 유지 → 결과 카드에 ‘확인 필요’로 남김"),
          ("보호 규칙", "취업상태·낮은 신뢰도·우대/예외는 불일치해도 즉시 탈락시키지 않음")]
    for i,(a,b) in enumerate(rows):
        y=284-i*23; text(c,48,y,a,8,[BLUE,MINT,ORANGE,SUB,RED][i],"KB"); text(c,117,y,b,7.8,INK,"K",390)
    # runtime lane
    box(c,550,185,256,150,white,LINE,12)
    text(c,566,309,"저장 후 반복 조사",10,NAVY,"KB")
    steps=["Vercel Cron  매일 09:00 KST", "저장 답변으로 전체 공고 재판정", "새 ID · 마감 변경 · D-3 감지", "Web Push 1건으로 요약", "Upstash에 조사 기록·주간 리포트"]
    for i,s in enumerate(steps):
        c.setFillColor([BLUE,BLUE,MINT,ORANGE,NAVY][i]); c.circle(574,282-i*24,4,stroke=0,fill=1)
        text(c,586,278-i*24,s,8.2,INK,"K")
    text(c,32,151,"기술 스택",9,SUB,"KB")
    text(c,105,151,"Next.js 15 · React 19 · Tailwind 4 · API Routes · Gemini REST · Jev · Vercel Cron · Upstash Redis · Web Push",8.4,INK,"K")
    footer(c,6)
    c.showPage()


def add_flow(c):
    header(c,"05","핵심 기능 및 사용자 흐름","질문에서 다음 날 알림까지 끊기지 않는 Happy Path")
    feats=[("1  스무고개 질문", "예·아니오·모름\n최대 6문항\n답별 남을 후보 수 표시", BLUE),
           ("2  설명 가능한 결과", "상위 3개 먼저\n맞는 이유·확인 필요\n병목 조건과 +N건", MINT),
           ("3  반복 리서치", "조건 저장\n매일 재조회\n새 공고·마감 변화 푸시", ORANGE)]
    for i,(t,b,col) in enumerate(feats):
        x=42+i*255; box(c,x,H-262,235,135,white,LINE,12); pill(c,x+16,H-166,t,col); text(c,x+16,H-198,b,10,INK,"K",200,19)
    text(c,42,H-305,"주요 사용자 이용 흐름 (Happy Path)",12,NAVY,"KB")
    labels=[("홈", "관심 분야 선택"),("질문 4~6개", "가장 잘 가르는 순서"),("결과", "통과·확인 필요"),("조건 저장", "알림 동의"),("다음 날", "변화만 푸시"),("알림함", "주간 리포트")]
    for i,(a,b) in enumerate(labels):
        x=32+i*132; col=[NAVY,BLUE,MINT,CYAN,ORANGE,NAVY][i]
        c.setFillColor(col); c.circle(x+49,171,28,stroke=0,fill=1); centered(c,x+49,166,str(i+1),13,white,"KB")
        centered(c,x+49,125,a,9,INK,"KB"); centered(c,x+49,108,b,6.8,SUB,"K")
        if i<5: arrow(c,x+80,171,x+130,171,HexColor("#94A3B8"),1.5)
    box(c,42,51,744,38,PALE,LINE,8)
    text(c,58,65,"데모 기준: 주거+채용 선택 → 질문 → 상위 공고 → 분석 → ‘더보기/질문 더 해서 좁히기’ → 알림 저장",8.5,BLUE,"KB")
    footer(c,7)
    c.showPage()


def add_diff(c):
    header(c,"06","차별점","추천 앱이 아니라, 여러 분야의 ‘개별 공고’를 한 조건으로 반복 조사")
    cols=[100,270,535]; widths=[160,250,250]
    text(c,42,H-120,"비교 항목",9,SUB,"KB"); text(c,210,H-120,"분야별 기존 서비스",9,SUB,"KB"); text(c,480,H-120,"찾아줄게",9,BLUE,"KB")
    rows=[("조건 입력","주거·채용·혜택마다 다시 입력","한 번 입력해 6개 분야 공통 사용"),
          ("탐색 단위","혜택 또는 한 분야의 공고","기한 있는 개별 공고를 분야 횡단"),
          ("결과가 적을 때","0건 또는 무관 추천","어떤 조건이 줄였는지 +N건으로 설명"),
          ("알림","새 공고 중심·서비스별 분산","새 공고 + 마감 변경 + D-3를 한 번에"),
          ("불확실성","최종 자격과 추천이 섞이기 쉬움","AI 해석·확인 필요·샘플·원문 배지")]
    y=H-155
    for i,(a,b,d) in enumerate(rows):
        fill=white if i%2==0 else PALE
        c.setFillColor(fill); c.rect(42,y-47,744,52,stroke=0,fill=1)
        text(c,56,y-16,a,9,NAVY,"KB"); text(c,210,y-16,b,8.5,INK,"K",240); text(c,480,y-16,d,8.5,BLUE,"KB",285)
        y-=58
    box(c,42,67,744,76,HexColor("#FFF7ED"),HexColor("#FED7AA"),10)
    text(c,60,116,"정직한 차별화 문장",8.5,ORANGE,"KB")
    text(c,60,91,"“확인한 범위에서, 분야별 서비스에 흩어진 조건 입력과 반복 확인을 하나의 흐름으로 연결했다.”",12,NAVY,"KB")
    text(c,60,75,"‘국내 최초·유일’, 서비스별 누락률 같은 검증되지 않은 표현은 사용하지 않는다.",7.4,SUB)
    footer(c,8,"비교 대상: 정부24 혜택알리미 · 온통청년 · LH/마이홈 · 잡알리오/채용앱")
    c.showPage()


def add_impl(c):
    header(c,"07","구현 현황 및 프로토타입","실데이터·AI 정확도·자동 테스트로 확인한 작동 범위")
    metrics=[("95", "자동 테스트 통과"),("6", "공식 API 실호출 확인"),("3초", "초기 목록 로딩"),("94.6%", "조건 구조화 정밀도"),("92.1%", "조건 구조화 재현율")]
    for i,(n,l) in enumerate(metrics):
        x=32+i*155; box(c,x,H-206,140,82,white,LINE,10); centered(c,x+70,H-165,n,21,[BLUE,MINT,CYAN,ORANGE,RED][i],"KB"); centered(c,x+70,H-190,l,7.5,SUB,"K")
    box(c,32,H-395,360,160,PALE,LINE,12)
    text(c,50,H-260,"구현 완료",10,NAVY,"KB")
    done=["홈 → 질문 → 결과 → 분석 → 저장 → 알림함", "LH·마이홈·청약홈·잡알리오·공공서비스·Q-Net 실호출", "규칙 우선 + Gemini 조건 보완, Jev 공고 판별", "마감 변경·D-3 감지, 출처 간 중복 제거, 주간 리포트", "소유자 토큰·Cron 인증·푸시 호스트 제한·삭제 기능"]
    for i,s in enumerate(done): text(c,50,H-287-i*22,"✓  "+s,8.4,INK,"K",320)
    box(c,418,H-395,388,160,HexColor("#FFF7ED"),HexColor("#FED7AA"),12)
    text(c,436,H-260,"제출 전 확인 필요",10,ORANGE,"KB")
    pending=["Vercel 공개 URL · 로그아웃 상태 접근", "Upstash 연결 후 실제 Cron 이력", "앱 종료 상태에서 Web Push 수신", "팀명·대표자·팀원·역할", "알바·국비 과정은 현재 예시 데이터"]
    for i,s in enumerate(pending): text(c,436,H-287-i*22,"□  "+s,8.4,INK,"K",350)
    text(c,32,164,"AI 조건 구조화 검증 · 실공고 20건 / 정답 조건 38개",10,NAVY,"KB")
    stat_bar(c,32,130,"규칙 우선 + AI 보완  정밀도",94.6,BLUE,310)
    stat_bar(c,430,130,"규칙 우선 + AI 보완  재현율",92.1,MINT,310)
    footer(c,9,"2026.11.22 재검증: Vitest 95 pass / ESLint pass / Next.js production build pass")
    c.showPage()


def add_effect(c):
    header(c,"08","기대효과","반복 탐색 시간을 줄이고, 더 적은 알림으로 더 설명 가능한 기회를 제공")
    effects=[("개인", "여러 사이트를 반복 확인하는 부담 감소\n조건에 맞지 않는 공고를 먼저 제외\n마감 변화와 임박 공고를 놓칠 위험 완화", BLUE),
             ("상담 현장", "청년센터·대학 상담 전에 공통 조건 정리\n결과가 적은 이유를 숫자로 함께 확인\n공고 원문 중심의 설명 가능한 상담", MINT),
             ("공공", "분산된 공고의 추가 도달 경로\n출처·샘플·AI 해석을 구분한 투명한 전달\n공개 API를 조합한 낮은 운영 부담", ORANGE)]
    for i,(t,b,col) in enumerate(effects):
        x=42+i*255; box(c,x,H-290,235,170,white,LINE,12); c.setFillColor(col); c.circle(x+34,H-155,16,stroke=0,fill=1); centered(c,x+34,H-160,str(i+1),10,white,"KB"); text(c,x+62,H-159,t,14,NAVY,"KB"); text(c,x+18,H-200,b,9.5,INK,"K",200,21)
    box(c,42,96,744,165,PALE,HexColor("#C7D7FF"),12)
    text(c,62,233,"확장 로드맵",11,BLUE,"KB")
    roadmap=[("1", "출처 확장", "지자체 청년 공고·SH 등\n어댑터 단위 추가"),("2", "품질 측정", "실사용 클릭·원문 확인·\n알림 유용성 피드백"),("3", "조건 고도화", "구 단위 지역·복수 소득 기준·\n통근 시간 필터"),("4", "운영 최적화", "변경/삭제 감지·캐시·\nAI 호출 비용 제어")]
    for i,(n,t,b) in enumerate(roadmap):
        x=62+i*178; pill(c,x,194,n,BLUE); text(c,x+34,198,t,9,NAVY,"KB"); text(c,x,168,b,7.8,INK,"K",160,15)
    text(c,62,113,"효과 수치는 실사용 데이터 확보 후 측정하며, 현재 소개서에서는 구현·검증된 범위만 주장한다.",8.5,SUB,"KB")
    footer(c,10)
    c.showPage()


def add_appendix(c):
    header(c,"별첨","팀 구성 및 사전 개발 내역 고지","지정 별첨 · 제출 전 인적 정보와 사실 확인 필요")
    box(c,32,H-230,360,110,white,LINE,10)
    text(c,48,H-145,"팀 구성 및 역할",10,NAVY,"KB")
    text(c,48,H-175,"이름",8,SUB,"KB"); text(c,140,H-175,"역할",8,SUB,"KB"); text(c,230,H-175,"담당 업무",8,SUB,"KB")
    text(c,48,H-204,"[입력 필요]",9,RED,"KB"); text(c,140,H-204,"[입력 필요]",9,RED,"KB"); text(c,230,H-204,"[입력 필요]",9,RED,"KB")
    box(c,414,H-230,392,110,white,LINE,10)
    text(c,430,H-145,"기존 개발물 · 사전 개발 내역",10,NAVY,"KB")
    text(c,430,H-176,"해커톤 이전 개발 범위",8,SUB,"KB"); text(c,570,H-176,"[사실 확인 필요]",8.5,RED,"KB")
    text(c,430,H-199,"해커톤 기간 개발",8,SUB,"KB"); text(c,570,H-199,"기획·웹앱·데이터 연동·AI·검증",8.5,INK,"K")
    text(c,430,H-222,"타 공모전 출품·수상",8,SUB,"KB"); text(c,570,H-222,"[사실 확인 필요]",8.5,RED,"KB")
    text(c,32,H-270,"활용한 외부 자원 · 출처",11,NAVY,"KB")
    rows=[
        ("오픈소스", "Next.js 15.5.29 · React 19.1 / MIT", "웹앱·API"),
        ("오픈소스", "Tailwind CSS 4 / MIT · web-push 4 / MPL-2.0 · Vitest 3 / MIT", "UI·푸시·테스트"),
        ("외부 API", "공공데이터포털: LH·마이홈·청약홈·잡알리오·공공서비스·Q-Net", "공고 수집"),
        ("선택 출처", "SH 공식 RSS · Exa/Tavily 웹검색(공공기관 도메인, 원문 확인)", "공고 보충"),
        ("AI", "Google Gemini 3.5 Flash-Lite · TypeSafe Jev 1.14.0", "조건 보완·공고 판별"),
        ("개발 도구", "Claude Code · OpenAI Codex · ChatGPT 심층 리서치", "코드·검토·조사"),
        ("통계", "국무조정실 2024 청년 삶 실태조사(만 19~34세 15,098명)", "문제 정의")]
    y=H-302
    for i,(a,b,d) in enumerate(rows):
        c.setFillColor(white if i%2==0 else PALE); c.rect(32,y-32,774,34,stroke=0,fill=1)
        text(c,44,y-17,a,7.6,NAVY,"KB"); text(c,125,y-17,b,7.3,INK,"K",540); text(c,690,y-17,d,7.3,SUB,"K")
        y-=36
    text(c,32,54,"상세 URL·이용조건: data.go.kr 각 API 페이지, github.com/vercel/next.js, react.dev, tailwindcss.com, github.com/web-push-libs/web-push, vitest.dev",6.5,SUB,"K",770)
    footer(c,11)
    c.showPage()


def build():
    register_fonts(); OUT.parent.mkdir(parents=True, exist_ok=True)
    c=canvas.Canvas(str(OUT), pagesize=(W,H), pageCompression=1)
    c.setTitle("찾아줄게 프로젝트 소개서"); c.setAuthor("찾아줄게 팀")
    for fn in [add_cover,add_summary,add_problem,add_user,add_ai,add_arch,add_flow,add_diff,add_impl,add_effect,add_appendix]: fn(c)
    c.save(); print(OUT)


if __name__ == "__main__": build()
