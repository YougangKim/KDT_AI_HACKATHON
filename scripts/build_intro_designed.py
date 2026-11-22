"""제출 소개서: Noto Sans KR, 16:9, 본문 10쪽 + 표지/지정 별첨."""
from pathlib import Path
import math
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf'
W,H=960,540
INK='#172D35'; ACC='#087F78'; SUB='#54656A'; LINE='#D7E1DF'; PALE='#EEF5F3'; WHITE='#FFFFFF'; WARN='#92542F'
for name,weight in [('R','Regular'),('M','Medium'),('B','Bold')]:
    pdfmetrics.registerFont(TTFont(name,f'C:/Windows/Fonts/NotoSansKR-{weight}.ttf'))


def rect(c,x,y,w,h,fill=PALE):
    c.setFillColor(HexColor(fill)); c.rect(x,y,w,h,fill=1,stroke=0)


def line(c,x,y,x2,y2,color=LINE,width=1):
    c.setStrokeColor(HexColor(color)); c.setLineWidth(width); c.line(x,y,x2,y2)


def txt(c,x,y,s,size=16,font='R',color=INK,width=None,leading=None):
    leading=leading or size*1.5
    rows=[]
    for para in str(s).split('\n'):
        row=''
        for word in para.split(' '):
            probe=(row+' '+word).strip()
            if width and row and pdfmetrics.stringWidth(probe,font,size)>width:
                rows.append(row); row=word
            else: row=probe
        rows.append(row)
    c.setFont(font,size); c.setFillColor(HexColor(color))
    for row in rows:
        c.drawString(x,y,row); y-=leading
    return y


def arrow(c,x,y,x2,y2,color=ACC):
    line(c,x,y,x2,y2,color,1.5)
    a=math.atan2(y2-y,x2-x); p=c.beginPath(); p.moveTo(x2,y2)
    p.lineTo(x2-6*math.cos(a-.5),y2-6*math.sin(a-.5))
    p.lineTo(x2-6*math.cos(a+.5),y2-6*math.sin(a+.5)); p.close()
    c.setFillColor(HexColor(color)); c.drawPath(p,fill=1,stroke=0)


def head(c,section,title,sub=None):
    rect(c,0,0,W,H,WHITE)
    txt(c,52,478,section,30,'B')
    txt(c,52,444,title,17,'M',ACC)
    if sub: txt(c,52,405,sub,11,'R',SUB,width=850)
    line(c,52,425,908,425)


def foot(c,source='찾아줄게  /  2026 대한민국 청년 CAREER FAIR AI 해커톤'):
    line(c,52,42,908,42)
    txt(c,52,23,source,9,'R',SUB)
    c.setFont('M',10); c.drawRightString(908,23,f'{c.getPageNumber():02}')


def link(c,x,y,label,url,size=10):
    txt(c,x,y,label,size,'R',ACC)
    c.linkURL(url,(x,y-3,x+pdfmetrics.stringWidth(label,'R',size),y+size+2),relative=0,thickness=0)


def cover(c):
    rect(c,0,0,W,H,INK)
    txt(c,56,467,'2026 대한민국 청년 CAREER FAIR AI 해커톤',13,'M','#CEDDD9')
    txt(c,52,343,'찾아줄게',64,'B',WHITE)
    txt(c,56,282,'청년 맞춤 공고 탐색·반복 조사\nAI 에이전트',25,'M',WHITE,leading=39)
    line(c,56,160,904,160,'#526A6D')
    txt(c,56,122,'주거 · 채용 · 지원금  /  질문 기반 필터링 · 조건 저장 · 새 공고 알림',14,'R','#CEDDD9')
    for x,label in [(56,'팀명'),(260,'대표자'),(464,'팀원')]:
        txt(c,x,79,label,12,'M','#CEDDD9'); txt(c,x,55,'[제출 전 입력]',12,'R','#CEDDD9')
    txt(c,724,69,'2026. 11. 22.',12,'M','#CEDDD9')
    c.showPage()


def summary(c):
    head(c,'프로젝트 요약','청년 맞춤 공고 탐색·반복 조사 AI 에이전트')
    txt(c,52,363,'한 줄 요약',13,'B',ACC)
    txt(c,52,327,'짧은 질문으로 찾는 맞춤 공고,\n저장한 조건으로 이어지는 반복 조사',25,'M',width=800,leading=37)
    for x,num,title,body in [(52,'1','문제','분야별 정보 분산\n조건 재입력·반복 확인'),(350,'2','해결 방안','최대 6문항·공통 조건\n근거 표시·새 공고 알림'),(648,'3','구현 현황','공식 API 6종 실호출 기록\n로컬 구현·운영 검증 대기')]:
        line(c,x,250,x+260,250,ACC,2)
        txt(c,x,218,num,13,'B',ACC); txt(c,x+24,216,title,21,'B')
        txt(c,x,177,body,17,'R',SUB,leading=28)
    rect(c,52,66,856,44)
    txt(c,68,82,'키워드  |  청년 주거·취업 · 공공데이터 · 조건 추출 · 질문형 탐색 · 반복 조사',13,'M')
    foot(c); c.showPage()


def problem(c):
    head(c,'01 문제 정의','청년 정책 수요와 분야별 정보 분산')
    txt(c,52,382,'가장 필요한 정책 분야',17,'B')
    for i,(name,val) in enumerate([('주거',45.7),('일자리',33.5),('복지·문화',14.1),('교육',5.5),('참여·권리',1.2)]):
        y=338-i*44; txt(c,52,y,name,14,'M'); rect(c,149,y-1,290,14,'#EAF0EE')
        rect(c,149,y-1,290*val/50,14,ACC if i<2 else '#B2C8C1')
        txt(c,454,y,f'{val:.1f}%',15,'B',ACC if i<2 else SUB)
    txt(c,149,100,'0',10,'R',SUB); txt(c,409,100,'50%',10,'R',SUB)
    line(c,534,109,534,386)
    txt(c,575,365,'공공임대 거주',16,'B')
    txt(c,575,315,'71.7%',34,'B',ACC); txt(c,735,320,'의향',15,'M')
    txt(c,575,266,'7.0%',28,'B'); txt(c,735,271,'경험',15,'M')
    txt(c,575,218,'거주 의향과 경험 사이에 격차가 존재한다.\n공고 누락과의 인과관계는 확인되지 않았다.',12,'R',SUB,leading=22)
    txt(c,575,147,'설계 출발점',13,'B',ACC)
    txt(c,575,120,'분야별 조건 입력 통합\n저장 조건 기반 반복 확인',16,'M',leading=25)
    foot(c,'출처: 국무조정실, 2024 청년의 삶 실태조사 보도자료(2025.3.11 잠정치), 청년 15,098명. 상세 링크: 별첨')
    c.showPage()


def users(c):
    head(c,'02 대상 사용자','독립·취업 준비 청년과 상담 지원기관')
    txt(c,52,365,'주요 사용자',13,'B',ACC)
    txt(c,52,315,'만 19~34세\n독립·독립 준비 청년',29,'B',leading=43)
    txt(c,52,218,'주거 모집공고·공공기관 채용·지원금을\n함께 탐색하는 청년을 주요 대상으로 한다.',16,'R',SUB,leading=29)
    txt(c,52,136,'보조 사용자',13,'B',ACC)
    txt(c,52,107,'청년센터·대학 취업지원 상담사',17,'M')
    for y,title,body in [(365,'입력 부담','긴 양식 대신 짧은 질문으로 조건 설정'),(260,'탐색 부담','저장한 답변을 여러 분야에서 재사용'),(155,'판단 부담','맞는 이유와 확인할 조건을 함께 제시')]:
        line(c,510,y+22,908,y+22)
        txt(c,510,y,title,20,'B'); txt(c,510,y-35,body,16,'R',SUB,width=390)
    foot(c); c.showPage()


def ai(c):
    head(c,'03 AI를 활용한 해결 방안','규칙 우선 조건 추출·AI 보완')
    stages=[('공고 원문','기관별로 다른\n자격요건 문장'),('규칙 추출','명시적인 나이·지역·\n무주택 조건 유지'),('Gemini 보완','규칙이 추출하지 못한\n속성만 추가'),('코드 판정','답변과 조건 비교\n통과 / 확인 필요')]
    for i,(title,body) in enumerate(stages):
        x=52+i*220; rect(c,x,249,196,126,PALE if i!=2 else '#DEEEEA')
        txt(c,x+16,342,title,20,'B',ACC if i==2 else INK)
        txt(c,x+16,305,body,14,'R',SUB,leading=23)
        if i<3: arrow(c,x+198,310,x+218,310)
    txt(c,52,205,'AI 활용 필요성',15,'B',ACC)
    txt(c,52,175,'AI는 기관별 비정형 자격요건을 공통 조건으로 변환하고 질문 표현을 보정한다.',16,'R')
    txt(c,52,126,'오류 대응',15,'B',ACC)
    txt(c,52,96,'근거가 부족한 해석은 제거하며, 모름·저신뢰·우대 조건은 확인 대상으로 유지한다.\nAI 해석 여부와 원문 링크를 제공한다. 최종 신청 자격은 공고처 기준에 따라 확인해야 한다.',14,'R',SUB,leading=23)
    foot(c,'서비스 AI: Gemini(조건 보완·질문 문장), Jev(검색 결과의 공고 여부). 모델·호출 범위는 별첨 참조')
    c.showPage()


def architecture(c):
    head(c,'04 서비스 구조','API 연계·조건 필터링·반복 조사 아키텍처')
    labels=[('공식 API','LH·마이홈·청약홈\n잡알리오·공공서비스\nQ-Net'),('공통 공고','분야·지역·마감\n원문 URL·출처'),('조건 구조화','규칙 우선\nGemini 보완'),('질문·필터','남은 후보를 비교\n다음 질문 선택'),('결과 화면','통과·확인 필요\n원문·조건별 분석')]
    for i,(a,d) in enumerate(labels):
        x=52+i*176; rect(c,x,273,152,112)
        txt(c,x+12,355,a,17,'B'); txt(c,x+12,326,d,12.5,'R',SUB,leading=20)
        if i<4: arrow(c,x+153,335,x+173,335)
    txt(c,52,235,'검색 보충',13,'B',ACC)
    txt(c,154,235,'Tavily → 실패 시 Exa → 제목 필터 → Jev 공고 판별 → 후보 합류',14,'M')
    txt(c,154,211,'검색 공고는 자격조건 미추출 상태로 원문 확인이 필요하다. SH RSS는 선택적 수집 경로이다.',11,'R',SUB)
    line(c,52,188,908,188)
    lower=[('조건 저장','PWA → /api/watch'),('Upstash Redis','답변·구독·본 공고 보관'),('Vercel Cron','매일 09:00 재조회'),('Web Push','새 공고·마감 변화 알림')]
    for i,(a,d) in enumerate(lower):
        x=52+i*220; txt(c,x,153,a,17,'B',ACC); txt(c,x,124,d,12,'R',SUB)
        if i<3: arrow(c,x+188,149,x+211,149)
    for x,label,value in [(52,'프론트/클라이언트','Next.js 15 · React 19 · PWA'),(350,'백엔드/에이전트','API Routes · 규칙 필터 엔진'),(648,'AI 모델','Gemini 3.5 Flash Lite · jev-latest')]:
        txt(c,x,94,label,10,'B',ACC); txt(c,x,78,value,10,'R',SUB)
    txt(c,52,57,'데이터: 공공 API 6종·이용허락범위 제한 없음(별첨)  |  배포: 로컬 검증 완료·Vercel 운영 검증 대기',10,'R',SUB)
    foot(c); c.showPage()


def filtering(c):
    head(c,'04 서비스 구조 · 필터 예시','질문별 후보 축소와 확인 필요 조건','가상 공고를 활용한 설명이다. 실제 질문 순서는 남은 후보와 이전 답변에 따라 결정된다.')
    txt(c,52,388,'A 서울·무주택     B 경기·무주택     C 전국·만 29세 이하     D 전국·미취업 조건',15,'M')
    stages=[('서울에 거주하나요?','예','4 → 3','A · C · D 유지','B는 지역 불일치로 제외'),('무주택자인가요?','아니오','3 → 2','C · D 유지','A는 무주택 불일치로 제외'),('만 29세 이하인가요?','모름','2 → 2','C · D 유지','C는 나이 확인 필요')]
    for i,(q,a,n,left,why) in enumerate(stages):
        x=52+i*296; line(c,x,351,x+264,351,ACC,2)
        txt(c,x,319,q,18,'B'); txt(c,x,287,a,14,'M',ACC)
        txt(c,x,219,n,42,'B',INK)
        txt(c,x,176,left,18,'M'); txt(c,x,147,why,13,'R',SUB)
    txt(c,52,93,'필수조건 불일치 시 후보를 제외한다. 모름·취업상태·저신뢰·우대·예외 조건은 확인 대상으로 유지한다.',12,'M',ACC)
    txt(c,52,68,'비교 기준: 나이·소득 범위 / 지역 허용·제외 / 무주택·1인 가구 참·거짓',12,'R',SUB)
    foot(c); c.showPage()


def happy(c):
    head(c,'05 핵심 기능 및 사용자 흐름','맞춤 탐색 · 조건별 분석 · 반복 조사 알림')
    labels=[('관심 분야','주거·채용 등 선택'),('짧은 질문','최대 6문항'),('결과 확인','3개 먼저·추가 탐색'),('조건 저장','알림 동의'),('변화 확인','새 공고·마감 변화')]
    for i,(title,body) in enumerate(labels):
        x=52+i*176
        txt(c,x,357,f'{i+1:02}',15,'B',ACC); txt(c,x,316,title,21,'B')
        txt(c,x,284,body,12,'R',SUB)
        if i<4: arrow(c,x+140,350,x+169,350)
    line(c,52,246,908,246)
    txt(c,52,209,'후속 탐색·분석',19,'B')
    txt(c,52,172,'추가 후보 조회와 후속 질문을 통해 탐색 범위를 조정한다.\n분석 화면은 탈락 요인과 확인 필요 조건, 필터 병목을 제공한다.',17,'R',SUB,leading=28)
    rect(c,52,67,856,52)
    txt(c,70,86,'Happy Path: 질문 → 결과 → 저장 → 재조사 → 알림함  |  운영 Cron·앱 종료 푸시: 검증 대기',12,'M')
    foot(c); c.showPage()


def difference(c):
    head(c,'06 차별점','분야 간 조건 재사용·필터 근거·변화 알림')
    txt(c,52,378,'비교 축',13,'M',SUB); txt(c,250,378,'분야별 서비스의 일반적 이용 흐름',14,'M',SUB); txt(c,610,378,'찾아줄게',16,'B',ACC)
    rows=[('조건 입력','분야별로 조건을 다시 설정','공통 답변을 여러 분야에 재사용'),('결과 이해','추천 목록에서 원문을 개별 확인','맞는 이유·확인 필요·필터 병목 표시'),('반복 확인','주거·채용·혜택 알림을 각각 확인','새 공고·마감 변경·D-3를 묶어 전달')]
    for i,(a,d,e) in enumerate(rows):
        y=326-i*76; line(c,52,y+29,908,y+29)
        txt(c,52,y,a,18,'B'); txt(c,250,y,d,15,'R',SUB); txt(c,610,y,e,15,'M')
    txt(c,52,90,'비교 범위는 이용 흐름과 통합 방식이다. 기존 서비스에도 맞춤 추천·마감 알림이 존재하므로 독점적 기능으로 해석하지 않는다.',11,'R',SUB,width=850)
    foot(c,'비교 참고: 정부24 혜택알리미, 온통청년, LH·마이홈, 잡알리오. 기존 조사 자료 기준')
    c.showPage()


def implementation(c):
    head(c,'07 구현 현황 및 프로토타입','로컬 검증 결과·공개 운영 준비 현황')
    txt(c,52,376,'조건 추출 평가',18,'B'); txt(c,52,349,'공고 20건 · 정답 조건 38개 · Codex 교차 평가',12,'R',SUB)
    names=['AI 단독','규칙 단독','규칙 + AI']; precision=[93.5,97.1,94.6]; recall=[76.3,89.5,92.1]
    txt(c,224,316,'정밀도',12,'M',ACC); txt(c,336,316,'재현율',12,'M',SUB)
    for i,name in enumerate(names):
        y=280-i*60; txt(c,52,y,name,16,'M')
        txt(c,224,y,f'{precision[i]}%',21,'B',ACC); txt(c,336,y,f'{recall[i]}%',21,'B')
        line(c,52,y-17,451,y-17)
    txt(c,52,105,'앱 방식: 정확 추출 35/37 · 정답 포착 35/38\n소표본 조건 추출 평가로, 최종 자격 판정 정확도와는 구분된다.',11,'R',SUB,leading=19)
    line(c,494,90,494,384)
    txt(c,535,376,'로컬 검증 완료',18,'B',ACC)
    txt(c,535,342,'자동 테스트 95개 통과 · 1개 제외\n빌드·타입 검사·린트 통과\n게임·결과·저장·재조사 흐름 구현',15,'R',leading=27)
    txt(c,535,221,'공개 운영 검증 대기',18,'B',WARN)
    txt(c,535,187,'공개 URL / 로그아웃 접속\nUpstash 연결 / 실제 Cron 실행\n앱 종료 상태 푸시 수신',15,'R',SUB,leading=27)
    foot(c,'2026.11.22 로컬 재검증 기록. AI 평가 근거: .ai-sync/tasks/20261121T154839-codex/result.md')
    c.showPage()


def effects(c):
    head(c,'08 기대효과','반복 탐색 부담 감소·근거 기반 후보 검토')
    txt(c,52,357,'사용자',19,'B',ACC)
    txt(c,52,313,'조건 재입력 최소화\n분야별 공고의 반복 확인 부담 감소',24,'M',leading=37)
    txt(c,52,207,'상담 현장',19,'B',ACC)
    txt(c,52,166,'상담 전 공통 조건 정리\n공고 근거·미확인 조건 공동 검토',22,'M',leading=35)
    line(c,566,107,566,377)
    txt(c,610,360,'다음 단계',18,'B')
    for y,a,d in [(316,'품질','원문 확인율·오탐 피드백 측정'),(241,'조건','구 단위 지역·복수 소득 기준 보완'),(166,'운영','삭제 감지·AI 호출 비용 제어')]:
        txt(c,610,y,a,15,'B',ACC); txt(c,610,y-28,d,14,'R',SUB,width=295)
    foot(c,'시간 절감·마감 누락 감소 등 정량 효과는 미측정 상태이며, 실사용 지표를 통한 후속 검증이 필요하다.')
    c.showPage()


def team(c):
    head(c,'지정 별첨 1','팀 구성 및 사전 개발 내역')
    txt(c,52,374,'이름',14,'M',SUB); txt(c,267,374,'역할',14,'M',SUB); txt(c,500,374,'담당 업무',14,'M',SUB)
    line(c,52,354,908,354)
    txt(c,52,320,'[입력 필요]',17,'M',WARN); txt(c,267,320,'[입력 필요]',17,'M',WARN); txt(c,500,320,'[입력 필요]',17,'M',WARN)
    line(c,52,288,908,288)
    rows=[('해커톤 이전 개발 범위','[팀 사실 확인 필요]'),('해커톤 기간 중 개발','기획·웹앱·데이터 연동·AI 구조화·반복 조사·검증'),('타 공모전 출품·수상 이력','[미수상·출품 철회 이력 포함, 팀 확인 필요]')]
    for i,(a,d) in enumerate(rows):
        y=245-i*60; txt(c,52,y,a,15,'M'); txt(c,320,y,d,14,'R',WARN if '[' in d else SUB,width=580)
    foot(c,'팀 정보와 사전 개발·타 공모전 이력은 저장소만으로 확정할 수 없으므로 제출 전 팀 확인이 필요하다.')
    c.showPage()


API=[('LH 분양임대공고문','한국토지주택공사','15058530','주거 공고','자동승인'),('마이홈 공공주택 모집공고','국토교통부','15108420','주거 공고','자동승인'),('청약홈 분양정보','한국부동산원','15098547','분양·민간임대','심의승인'),('공공기관 채용정보','재정경제부','15125273','잡알리오 채용','심의승인'),('대한민국 공공서비스(혜택)','행정안전부','15113968','정책·지원금','자동승인'),('국가자격 시험일정','한국산업인력공단','15074408','Q-Net 접수 일정','심의승인')]


def api_sources(c):
    head(c,'지정 별첨 2','활용한 외부 데이터·API','2026.11.22 공공데이터포털 원문 확인 기준이다. 상세 이용조건은 각 데이터의 출처 링크에 따른다.')
    txt(c,52,389,'데이터명 / 출처 링크',12,'B'); txt(c,400,389,'제공기관 / 사용 위치',12,'B'); txt(c,665,389,'이용허락 / 운영계정 승인',12,'B')
    for i,(name,org,num,use,approval) in enumerate(API):
        y=353-i*46; line(c,52,y+23,908,y+23)
        txt(c,52,y,name,13,'M'); link(c,52,y-16,'data.go.kr/data/'+num+'/openapi.do','https://www.data.go.kr/data/'+num+'/openapi.do',9)
        txt(c,400,y,org,12,'M'); txt(c,400,y-16,use,10,'R',SUB)
        txt(c,665,y,'이용허락범위 제한 없음',11,'M'); txt(c,665,y-16,'무료 / 운영 '+approval,10,'R',SUB)
    txt(c,52,67,'개발계정은 6종 모두 자동승인이다. 운영계정 심의 여부는 개발계정의 실호출 성공과 구분된다.',11,'R',SUB)
    foot(c,'API 응답은 조회 시점에 따라 변한다. 이용허락 표기는 데이터셋 페이지 기준이며, 원문 전체의 재배포 허락을 의미하지 않는다.')
    c.showPage()


def resources(c):
    head(c,'지정 별첨 3','소프트웨어·AI·문서 자원 출처')
    rows=[('웹앱·테스트','Next.js 15.5.29 / React 19.1 / Tailwind 4.3.5 / Vitest 3.2.4','MIT','https://github.com/vercel/next.js'),('푸시·AI SDK','web-push 4.0.0 / @anthropic-ai/sdk 1.12.0','MPL-2.0 / Apache-2.0','https://github.com/anthropics/anthropic-sdk-typescript'),('서비스 AI','Gemini: 조건·질문 문장 / Jev: 검색 공고 판별','각 제공자 API 약관','https://ai.google.dev/gemini-api/terms'),('검색·운영','Tavily·Exa / Vercel / Upstash','각 서비스 약관·계정 한도','https://exa.ai/terms-of-service'),('개발 AI','Claude Code / OpenAI Codex / ChatGPT 심층 리서치','각 서비스 이용약관','https://openai.com/policies/terms-of-use/'),('문서·폰트','ReportLab / Noto Sans KR Regular·Medium·Bold','BSD / SIL OFL 1.1','https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE')]
    for i,(a,d,lic,url) in enumerate(rows):
        y=378-i*47; line(c,52,y+20,908,y+20)
        txt(c,52,y,a,12,'B'); txt(c,190,y,d,12,'R'); txt(c,190,y-17,lic,10,'M',SUB)
        link(c,755,y-17,'출처·이용조건 ↗',url,10)
    txt(c,52,81,'모델 설정: gemini-3.5-flash-lite / Jev 요청 jev-latest(기존 응답 기록 jev-1.14.0). Claude는 선택 대체 경로.',10,'R',SUB)
    foot(c,'폰트는 PDF에 임베딩하였다. 외부 이미지·음원은 미사용이며, 그래프·도식은 자료와 코드 흐름을 바탕으로 작성하였다.')
    c.showPage()


def evidence(c):
    head(c,'지정 별첨 4','통계·검증 근거와 참고 출처')
    txt(c,52,377,'국무조정실 · 2024 청년의 삶 실태조사',18,'B')
    txt(c,52,347,'2025.3.11 보도자료 잠정치. 최종 분석 15,098가구·청년 15,098명.',13,'R',SUB)
    txt(c,52,322,'주거 정책 45.7%, 일자리 정책 33.5% / 공공임대 거주 의향 71.7%, 경험 7.0%.',13,'M')
    link(c,52,295,'정부 보도자료 원문 PDF ↗','https://www.opm.go.kr/opm/news/press-release.do?articleNo=158583&attachNo=146521&mode=download',11)
    line(c,52,274,908,274)
    txt(c,52,244,'조건 추출 평가 · 내부 소표본 검증',18,'B')
    txt(c,52,214,'공고 20건, 정답 조건 38개. 규칙+AI의 정밀도 35/37, 재현율 35/38.',13,'R')
    txt(c,52,190,'평가는 Codex가 수행하였다. 일반 사용자 효과나 최종 신청 자격의 정확도는 평가 범위에 포함되지 않는다.',12,'R',SUB)
    txt(c,52,166,'.ai-sync/tasks/20261121T154839-codex/result.md  /  plan/ai_eval_data.json',10,'R',SUB)
    line(c,52,145,908,145)
    txt(c,52,118,'기존 민간조사 표현 정정',14,'B')
    txt(c,52,92,'50.5%는 “정책 대상이 아니거나 대상 여부가 불분명”의 합산 응답이다. 본문 핵심 통계에서는 제외하였다.',11,'R',SUB)
    link(c,52,68,'소셜임팩트뉴스 2026.2.20 / 조사 2026.1.16~31, 521명 ↗','https://www.socialimpactnews.net/news/articleView.html?idxno=5677',10)
    foot(c,'자료 확인은 Tavily 사용량 한도(432)로 Exa를 활용하였다. 외부 자료의 주장과 프로젝트의 검증 결과는 구분하였다.')
    c.showPage()


def build():
    OUT.mkdir(parents=True,exist_ok=True)
    path=OUT/'찾아줄게_프로젝트소개서_20261122.pdf'
    c=canvas.Canvas(str(path),pagesize=(W,H),pageCompression=1)
    c.setTitle('찾아줄게 | 프로젝트 소개서'); c.setAuthor('찾아줄게 프로젝트')
    for fn in [cover,summary,problem,users,ai,architecture,filtering,happy,difference,implementation,effects,team,api_sources,resources,evidence]: fn(c)
    c.save()
    c=canvas.Canvas(str(OUT/'찾아줄게_API와_질문필터_흐름도.pdf'),pagesize=(W,H),pageCompression=1)
    architecture(c); filtering(c); c.save()
    print(path)


if __name__=='__main__': build()
