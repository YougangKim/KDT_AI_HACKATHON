"""기존 소개서의 API 연결도와 질문 필터 예시를 보완해 재생성한다."""
from pathlib import Path
import build_project_intro as b
from reportlab.pdfgen import canvas


def node(c, x, y, w, title, body, color=b.BLUE, h=70):
    b.box(c, x, y, w, h, b.white, b.LINE, 9)
    b.text(c, x+12, y+h-22, title, 10, color, "KB")
    b.text(c, x+12, y+h-42, body, 8, b.INK, "K", w-24, 13)


def architecture(c):
    b.header(c, "04", "API가 연결되는 서비스 구조", "공식 API와 검색 보충은 서로 다른 경로로 합쳐지고, 저장한 답변은 다음 조사에 재사용된다")
    node(c,32,384,236,"공식 API → 분야별 어댑터","주거: LH · 마이홈 · 청약홈\n채용: 잡알리오 / 혜택: 공공서비스\n자격: Q-Net",h=102)
    node(c,294,384,242,"공통 공고 + 규칙 조건","Opportunity: 분야·지역·마감·원문·출처\n자격요건 원문 → 규칙 우선 추출\nGemini → 규칙에 없는 속성만 보완",h=102)
    node(c,562,384,247,"후보 목록 → 질문 엔진","마감 필터 · 분야별 예시 폴백 · 중복 제거\n남은 후보 조건에서 질문 생성\n예/아니오 결과를 미리 계산해 질문 선택",h=102)
    b.arrow(c,268,435,294,435); b.arrow(c,536,435,562,435)
    node(c,32,270,236,"웹 검색 보충 (선택)","Tavily → 실패 시 Exa → 제목 필터\nJev: 개별 공고 확률 0.5 이상 유지\n실패 시 Jev 판별 생략",b.MINT,h=92)
    node(c,294,270,242,"보충 결과의 실제 처리","제목·URL·요약만 공통 공고로 변환\n현재 자격조건 배열은 비어 있음\nSH RSS도 별도 보충 경로",b.MINT,h=92)
    b.arrow(c,268,316,294,316,b.MINT)
    b.arrow(c,536,316,548,316,b.MINT); b.arrow(c,548,316,548,400,b.MINT); b.arrow(c,548,400,562,400,b.MINT)
    b.text(c,32,249,"사람인·온통청년·고용24는 키/설정 필요. 알바·국비 과정은 현재 예시 데이터.",7.5,b.SUB)
    b.arrow(c,685,384,685,223)
    node(c,562,143,247,"PWA: 답변 → 필터 → 결과","브라우저 엔진이 통과·확인 필요 계산\n공고 원문 확인 → 동의 후 조건 저장",b.ORANGE,h=80)
    node(c,294,143,242,"Next.js API + Upstash","/api/watch: 답변·본 공고·푸시 구독 저장\n소유자 토큰 확인 / 삭제 / 최대 60일",h=80)
    b.arrow(c,562,183,536,183)
    node(c,32,143,236,"Cron → 재조회 → Web Push","매일 09:00 KST, 같은 조건으로 재판정\n새 ID·마감 변경·D-3 → 알림·조사 기록",h=80)
    b.arrow(c,294,183,268,183)
    b.arrow(c,150,223,150,237); b.text(c,43,228,"같은 수집 경로를 반복 호출",7,b.BLUE)
    b.text(c,32,111,"검색 결과의 자격 적합성은 현재 보장하지 않는다. 원문 확인 필요. 운영 Cron·앱 종료 푸시는 배포 검증 대기.",8,b.RED,"KB",770)
    b.text(c,32,80,"클라이언트: Next.js 15 / React 19 / PWA    서버: API Routes / Vercel Cron    저장소: Upstash Redis    알림: Web Push",7.5,b.SUB)
    b.footer(c,6); c.showPage()


def filtering(c):
    b.header(c,"04+","답변 하나가 공고를 어떻게 거르는가", "설명을 위한 가상 공고 4건 · 실제 질문 순서는 후보 목록과 이전 답변에 따라 달라진다")
    examples=[("A  서울 청년주택","서울 · 무주택"),("B  경기 청년주택","경기 · 무주택"),("C  전국 청년지원","만 29세 이하"),("D  전국 채용","미취업 조건")]
    for i,(title,body) in enumerate(examples):
        node(c,32+i*197,420,184,title,body,h=65)
    stages=[("서울에 거주하나요?","예","A · C · D 유지","B 제외: 지역 불일치"),
            ("무주택자인가요?","아니오","C · D 유지","A 제외: 무주택 불일치"),
            ("만 29세 이하인가요?","모름","C · D 유지","C: 나이 확인 필요")]
    for i,(q,a,left,note) in enumerate(stages):
        x=32+i*267
        b.box(c,x,242,241,144,b.PALE,b.LINE,10)
        b.text(c,x+15,360,f"Q{i+1}  {q}",11,b.NAVY,"KB")
        b.pill(c,x+15,322,a,[b.BLUE,b.ORANGE,b.SUB][i])
        b.text(c,x+15,298,left,11,b.BLUE,"KB")
        b.text(c,x+15,272,note,8.5,b.INK)
        if i<2: b.arrow(c,x+241,310,x+264,310)
    b.text(c,32,216,"조건이 없는 공고는 해당 질문으로 제외하지 않는다. ‘아니오’ 자체가 탈락을 뜻하지 않으며, 필수조건과의 모순을 검사한다.",8,b.NAVY,"KB",775)
    b.box(c,32,85,374,108,b.white,b.LINE,10)
    b.text(c,47,169,"엄격 비교: 확실한 필수조건",10,b.BLUE,"KB")
    b.text(c,47,147,"나이 → 범위 축소 / 지역 → 허용·제외 값 누적\n무주택·1인 가구 → 참/거짓\n기준중위소득 → 같은 기준의 수치 비교",8.5,b.INK,"K",340,17)
    b.box(c,427,85,382,108,b.white,b.LINE,10)
    b.text(c,442,169,"후보 유지: 불확실하거나 예외인 조건",10,b.ORANGE,"KB")
    b.text(c,442,147,"모름·미질문 → 확인 필요\n취업상태·저신뢰·우대/예외 → 불일치해도 유지\n예: 알바 중이라고 답해도 D는 확인 필요로 남김",8.5,b.INK,"K",350,17)
    b.text(c,32,56,"코드 기준: engine/index.ts의 learn → decide → lenient → getMatches. 사용자 입력은 최종 신청 자격을 확정하지 않는다.",7,b.SUB)
    b.footer(c,7); c.showPage()


def build():
    b.register_fonts()
    # 페이지 추가에 따라 기존 푸터 번호를 실제 페이지 번호로 통일.
    old_footer=b.footer
    b.footer=lambda c,page,source=None: old_footer(c,c.getPageNumber(),source)
    old_text=b.text
    def text(c,x,y,s,*args,**kwargs):
        s=str(s).replace("긴 양식 대신 30초 게임", "짧은 질문 게임")
        if s=="30초": s="6문항"
        if s=="3초": s="약 3초*"
        if s=="초기 목록 로딩": s="기존 로컬 기록 (참고)"
        # AI 안전장치 마지막 줄과 검증 수치 사이에 여백 확보.
        if s=="검증" and y==117: y=80
        if s.startswith("실공고 20건") and y==117: y=80
        return old_text(c,x,y,s,*args,**kwargs)
    b.text=text
    old_center=b.centered
    def centered(c,x,y,s,*args,**kwargs):
        if s=="30초": s="6문항"
        if s=="3초": s="약 3초*"
        if s=="초기 목록 로딩": s="기존 로컬 기록"
        return old_center(c,x,y,s,*args,**kwargs)
    b.centered=centered
    b.OUT.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(b.OUT),pagesize=(b.W,b.H),pageCompression=1)
    c.setTitle("찾아줄게 프로젝트 소개서 - API 연결 및 질문 필터 보완")
    for fn in [b.add_cover,b.add_summary,b.add_problem,b.add_user,b.add_ai,architecture,filtering,b.add_flow,b.add_diff,b.add_impl,b.add_effect,b.add_appendix]: fn(c)
    c.save()
    # 소개서와 별도로 재사용할 수 있는 도식 PDF.
    diagram=b.OUT.parent / "찾아줄게_API와_질문필터_흐름도.pdf"
    c=canvas.Canvas(str(diagram),pagesize=(b.W,b.H),pageCompression=1)
    architecture(c); filtering(c); c.save()
    print(b.OUT)


if __name__=="__main__": build()
