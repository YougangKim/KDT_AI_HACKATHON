# 작업 로그 — 대한상공회의소 AI 해커톤

## 2026-11-24 19:20 My News 로고 시안 6종 (Codex 제작·Claude 조율)

- 현재 로고(남색 말풍선+신호 물결+민트 점) 기준으로 Codex가 서로 다른 스타일 시안 6개 SVG 제작(`.ai-sync/tasks/20261124T101505-codex/result.md`). 종이 신문 모티프 제외.
- `docs/설계/로고_시안/`: 시안1~6 `_icon.svg`(512)·`_wordmark.svg`(960x240), 비교 `비교.html`·`비교.png`(128/48/24px·어두운 배경), 생성 `build.mjs`, 렌더 `e2e/render-logos.mjs`.
- 앱 코드 미적용(사용자 선택 대기). 커밋·푸시 없음.

## 2026-11-24 15:00 피드백 설문·처리방침·방문 통계 배포 (Claude)

- 알림 저장 성공 직후 승인 메시지→설문 하단 시트(5문항)→완료 `components/result/FeedbackPrompt.tsx`, 저장 `/api/feedback`(Upstash `feedback:list`, 관리자 GET JSON 집계·`?format=csv`, `FEEDBACK_ADMIN_KEY` 또는 `CRON_SECRET`), `lib/feedback.ts`+테스트.
- 버그: 알림 서버 저장 답변 상한 40→200(추가 질문으로 73개가 되어 400 실패), 설문 오버레이 z-index를 지도 위로.
- `/privacy` 처리방침 + 하단 링크, Vercel Web Analytics 스크립트(대시보드에서 Analytics 켜야 수집, 현재 스크립트 404). Tally 버튼은 앱 안 설문과 중복이라 제외.
- 검증: test 230, tsc·lint, 로컬 e2e(저장→설문→제출→집계·재질문 없음). 커밋 1578346·a82da2d 푸시, Vercel 배포 success, 운영 /api/feedback 검증 응답·/privacy 200 확인.
- 추가(사용자 요청): 승인 메시지 10초 카운트다운 후 자동 닫힘(다음에와 동일 처리). 커밋 1449754, Vercel 배포 success.

## 2026-11-24 02:15 알림 설정 후 피드백 설문 시안 (Claude)

- `docs/설계/피드백_설문_시안.html`·`.png`: 알림 저장 성공 직후 승인 메시지 → 하단 시트 설문 5문항 → 완료. 사용자 평가 대기, 코드 변경 없음.

## 2026-11-24 01:15 피드백 수집 배포 방식 조사 (Claude 조율·Codex 조사)

- `docs/피드백_수집_배포방식.md`: 7개 방식 비교(무료 한도·출처), 추천 Vercel Web Analytics + Tally + `?ref=` 모집 링크, 처리방침 필수 항목, 핵심 지표 5개·설문 5문항. 코드 변경 없음.

## 2026-11-23 18:30 제출 후 개선 (Claude)
- 배포 커밋: 213e8fa README·.env.example / 4d6532d 홈 "지난 인터뷰 결과 보기"·알림 저장 즉시 확인 알림 / f13b457 카카오 로딩 대기·재시도 / 6077ffe 설정 바로 열기·"이 조건으로 저장하고 알림 받기"·저장 후 숨김 / 8c590b1·b1d9245 관련 자료 → 주요 언론 최근 3개월 기사, 인터뷰 답 반영 / b1d9245 채용 경력·직무 제목 판별(inferJobConditions) / 8154455 신청 준비 페이지(/prepare, /api/prep, lib/prep).
- 검증: 단위 200, e2e 14/14, 배포 사이트에서 IT·전기+경력 없음 흐름·신청 준비 화면 확인. AI 한도 소진 시 규칙 초안으로 동작.
- 남은 일: 채용 분야에 섞인 온통청년 일자리 정책(직무 없음) 구분, 지도 핀 지역 불일치, 같은 회사 묶기.

## 2026-11-23 15:50 결과 0건·빈 결과 수정, 제출 배포 (Claude)
- 지역 필터 정상화·정렬/보고 싶은 수·질문 공용 스킬셋(8fdce0f), 기본 질문 3개 뒤 남은 후보 10개 이하면 멈춤·마지막 답으로 0건이면 직전 단계 결과+안내(b9feb5f).
- "아직 결과가 없습니다" 원인: 후보 5,800여 건+결과를 sessionStorage에 저장하다 용량 초과(예외 무시). `saveLastResult`로 matches는 저장하지 않고 다시 계산, 넘치면 결과 공고만 저장. 테스트 추가.
- 카카오 지도 실패 원인: JS 키 등록 도메인이 localhost:3950·vercel뿐(5300은 401 domain mismatched). 로컬은 3950만 사용.
- 검증: 단위 196, e2e 14/14, build. GitHub 푸시 63f0738, Vercel 배포 success, 배포 사이트에서 지원금+채용 2,169개·주거 77개 결과 표시·카카오 지도 정상 확인.
- 남은 일: 서울 답인데 지도에 전남 핀 30개, 결과 수 과다(2,169) 검토. 채용 근무지 지도·같은 회사 묶기 미구현.

## 2026-11-23 09:58 Kakao 지도 및 온통청년 연결 (Codex)
- KakaoMap·SDK 로더·map-config API 연결. KAKAO_MAP_KEY 그대로 지원, REST 키 반환 방지 테스트. 실제 localhost:3950 Chrome에서 SDK·20개 로딩 타일·지도 클릭 후 나 핀 및 거리 선택 확인. 실패 시 기존 Leaflet 대체지도 유지. 단일 공고만 있을 때 지도 중심 보정.
- 온통청년 기존 환경변수 YOUTHCENTER_KEY와 사용자 YOUTHCENTER_API_KEY 불일치 수정. 키 미등록 시 0회 수집 캐시가 등록 후 첫 조회를 막지 않도록 pool 보정·회귀 테스트 추가. 공식 응답200 확인 및 기존 수집 실행, 앱 API 32건(혜택23/주거3/일자리6) 실제 확인. 기존 첫50건 조회 유지, 공식 전체3992건 전수 수집 완료 아님. 연령 플래그·분류 정확성 추가 확인 필요.
- 검증: 최종 단위173통과/1skip·tsc 통과. 지도 연결 버전 .next-prod 빌드 성공 및 E2E14/14(지도 인증은 모킹, Kakao 실동작 별도). 최종 단일 핀 중심 보정·온통청년 변경 이후 빌드/E2E는 재실행하지 않음. 배포·커밋·푸시 없음, 4개 스레드 검증 보류 유지.

## 2026-11-23 동적 질문 API 승인·연결 (Codex)
- 사용자가 “어 그래도 된다”로 선택 답변(상태·소득 등) 및 공고 근거 전송 승인. 이름·연락처·정확한 좌표 별도 필드는 전송하지 않는다.
- 기존 질문 UI 유지. next-question API가 후보 id만 고르던 방식에서 질문 문장·선택지·필요 이유 생성으로 변경. 프롬프트에 이력 기반 질문, 의미 반복 금지, 실제 공고 차이, 직무를 모르는 사용자를 위한 행동 표현, 자격 추측 금지 명시. 생성 선택지는 기존 필터 키에만 연결하고 누락/중복/무효 키·후보 감소 없는 질문을 거절한다.
- 변경 파일: web/app/api/next-question/route.ts 및 route.test.ts, web/lib/ai/question-contract.ts 및 test, web/app/play/page.tsx, e2e/scenarios.test.mjs.
- 검증: 단위 169통과/1skip, 프로덕션 빌드 통과, 실제 로컬 AI API(개인정보 없는 시험 입력) ai:true 및 새 질문 확인, 동적 질문 브라우저 단독 테스트 통과(질문 표시→선택→후보 감소→이력 전송). 질문의 의미상 정확성을 완전 보장하는 검증은 아니며 실제 사용자 시나리오 추가 필요.
- 기존 전체 회귀는 아직 불통과. 지도 d 실패 등 남음. 이전 전체 테스트는 구 제목·삭제된 지도 버튼과 외부 AI 호출 대기 문제도 섞여 있어 현행 요구 기준으로 분리 수정 중. 17개 전체 검수 완료/배포 완료라고 보고하지 않는다. 4개 스레드 보류 유지.

## 2026-11-23 사용자 검수 17항목 수정 진행 (Codex, 미완료)
- 수정 전 빌드 E2E 13/13 통과(고정 8 + 저장 실데이터 5). 기존 10/11 중 추가 질문 실패는 이번 기준선에서는 재현되지 않음. 새 변경 완료 판정과 혼동하지 말 것.
- 로컬 변경: 결과 6개 페이지, 분야 균등 배치, 홈 선택 6분야 보존 및 전체 pool 유지, 지도 핀→페이지 이동/묶음 목록, 방문 접수처 주소 추출, 분석 6분야 탭/기회/다른 분야 제안/답변 수정 취소, Tavily→Exa 공식 통계·동향 조회. 관련 파일 web/app/{play,result,result/analysis,api/insights}, web/components/result, web/lib/{geo/extract,sources/websearch}, e2e/scenarios.test.mjs.
- 중간 tsc 및 소스 eslint 통과. 단위 테스트 159통과/1실패/1skip: 구 정렬 기대값이 분야 균등 노출 요구와 충돌하여 기대값 변경. 이후 최종 재실행 필요. lint가 .next-prod 산출물을 읽는 문제는 ignore 추가. 빌드/브라우저 최종 검증 미완료.
- 사용자 재명확화: 기존 UI 유지, API가 이력/남은 공고에 근거해 유효한 질문·선택지 생성. 고정 분기 모듈을 추가했던 접근은 철회·제거. 기존 API는 후보 id 선택만 하므로 실제 생성+검증으로 변경해야 한다. 외부 API에 개인 답변/공고근거를 보내는 확대 패치는 자동 승인 검토에서 거절되어 적용하지 않았다. 전송 범위 승인 후 재개. 4개 스레드 검증 계속 보류, 배포/커밋/푸시 없음.

## 2026-11-23 프로젝트 소개서 두 버전 (Claude·Codex 교차)
- 예전 Codex 소개서(output/pdf/찾아줄게_…) 반려 이유: 사용자 원문 — 디자인 고급·깔끔(폰트·간격·여백), 양식 최소 규격 준수, 문장형 AI 문단·소제목 금지(명사형). 결과물 관찰: 앱 캡처 없음·글 상자 위주·옛 이름.
- 최신 로컬 앱(:3950) 모바일 캡처 8장 `docs/intro/assets/`(스크립트 `e2e/capture-intro.mjs`, 렌더 `e2e/render-intro.mjs`).
- Claude 버전 `docs/intro/claude.html/.pdf`, Codex 버전 `docs/intro/codex.html/.pdf`(각 11쪽). 교차 채점: Codex→Claude 57(`.ai-sync/tasks/20261122T152150-codex/result.md`), Claude→Codex 66(`docs/intro/review_by_claude_of_codex.md`). 양쪽 수정 반영 후 넘침 0.
- 남음: 팀명·대표자·팀원·사전 개발·출품 이력 입력, 운영 Cron·푸시 실측.

## 2026-11-23 My News 문서 내용 재검토 (Codex)
- 사용자 지적에 따라 최신 홈·manifest·보고서·AI 제공자·질문 선택·지도 코드를 재확인. 서비스명은 My News, 부제는 나만의 소식통. 일반 기사 요약기가 아니라 개인 조건·위치 기반 청년 공고 탐색·반복 알림 서비스.
- 기존 설명의 수정 대상: 예/아니오 전용 흐름, Gemini 단독 처리, 지도 누락, 예시 폴백, 배포/Upstash 미검증 표현. 운영 성공 기록과 최신 로컬 구현·운영 반영 여부를 분리해야 함.
- 이번 턴은 내용 검토이며 앱/제출물 수정·실환경 재검증·배포 없음. 상태판·로그만 갱신.

## 2026-11-22 저녁 지도·요약·개명 (Claude 조율, Codex 초안)
- 위치·반경 질문과 결과 지도(Leaflet+OSM, 키 없음): GPS/지도 찍기/건너뛰기, 1·2·5·10km 반경 필터, 핀↔리스트 연동, 거리 정렬. 카카오 키 있으면 주소→좌표, 없으면 시·도 중심.
- 카드: 규칙 기반 요약·신청 방법·"신청 페이지 열기"(정부24 신청방법·접수기관 등 공식 필드), AI 요약은 비차단(/api/summary, 4초 타임아웃·캐시).
- 주소 추출: 규칙(주소 정규식·청약홈 요약) → Gemini(최대 30건/회, 캐시) → 카카오 키 오면 좌표.
- 실측(실데이터): 결과 표시 약 1.0초(3회). AI 요약 첫 호출 2.3초·캐시 0.36초, 결과 표시를 막지 않음. Gemini 무료 한도(429)가 배경 AI 호출로 소진되는 문제 발견 → 429 시 10분 호출 중지.
- 서비스명 "마이뉴스": 앱 제목·홈·manifest·푸시·서비스워커·아이콘(192/512), 문서(보고서·소개서 초안, 조사 문서, 소개서 생성 스크립트).
- 검증: vitest 118, tsc·eslint·build, e2e 9/9. Codex 작성 → Claude 검토 수정(훅 순서, 지도 타입, 주소 정규식).

## 2026-11-22 Codex 평가 64/100 조건부 반영 (Claude)
- Codex(`.ai-sync/tasks/20261122T045341-codex/result.md`): 이전 배포본 34 → 64 조건부. 해결 2(복수 선택·탈락 공고 보기), 부분 4.
- 반영: 전체 건수(totalCount·matchCount) 기반 페이지 수 계산(최대 2,000건, 일부 쪽 실패는 경고 로그), "질문 더 해서 좁히기"는 남은 질문이 있을 때만 열고 없으면 이유 표시, AI 조건 해석 허용 속성에 새 조건 5종 추가(원문 근거 단어 필수), Gemini 다음 질문 선택 단위 테스트 2개, e2e 전체 분야 10문항 이상 단언.
- 검증: vitest 105, e2e 13/13(실데이터·실제 API 전체 분야 12문항).

## 2026-11-22 배포 사이트 피드백 6건 + 검수 결과 수정 (Claude)
- 공고 풀: 출처별 1쪽(50건) → 진행 중 공고 전체(잡알리오 6쪽·정부24 청년 4쪽·LH 공고중 전체). 실데이터 191 → 991건(`lib/sources/util.ts` fetchPages).
- 알바: 잡알리오 단기·기간제·대체인력을 "알바·단기직"(parttime)으로 분류 146건(`jobalio.ts` shortTerm). 채용과 함께 여러 분야 선택 가능.
- 질문 확장: 새 조건 8종(청약통장·신혼부부·수급/차상위·경력·학력·직무 분야·필요한 지원·임대/분양, `lib/sources/targets.ts`·`jobalio.ts` jobConditions·`gov24.ts`), 공공임대 무주택 조건. 엔진 `rankQuestions`: 탈락시키지 않아도 "확인 필요"를 푸는 질문도 점수, 청년 나이 19~39 기본 지식(만 60세 이상 같은 질문 제거). 선택형 질문(지역·나이·소득·학력·취업 상태·관심 분야·직무 분야·필요한 지원·주거 형태). 최대 12문항, 검수 중앙값 10문항.
- Gemini 다음 질문 선택: `/api/next-question`(규칙 상위 5개 후보 중 하나, 4초 초과·실패 시 규칙 1순위), 화면에 "AI가 고른 질문" 표시. AI 문장 다듬기는 존댓말로 통일.
- 분석: 조건별 탈락 막대·탭을 누르면 그 답 때문에 빠진 공고 제목·걸린 조건·원문 링크(`components/result/RemovedByQuestion.tsx`).
- 추가 질문 버튼: 5문항 더, 더보기 뒤에도 유지, 물을 게 없으면 안내 화면.
- 검수(A7): 잡알리오 근무지를 지역 조건으로 → 다른 지역 근무 공고가 상위에 안 나옴(회귀 테스트). 웹 검색 결과는 제목의 시도명을 지역으로. 원문 링크 여러 개면 첫 주소. 카드 근거는 분야보다 자격 근거 먼저.
- 검증: vitest 103, tsc·eslint·build, e2e 13/13(고정·스냅샷 991건·실제 API, 전체 분야 12문항 확인), 검수 스크립트(로컬) 12/17(남은 실패: A2 키워드 오탐, A4 질문 수 기준 3~8 vs 사용자 요구 10, A10 12문항 소진 시 추가 질문 없음, A12 자격증 7건, A13 기관 홈 링크 203건).

## 2026-11-22 시나리오 테스트 보강 3~4차 (Claude, 사용자 "고쳐")
- 소득 질문 반복 → 소득 구간 한 번에 선택(`web/app/play/page.tsx` incomeChoice, 지역과 같은 Choice 구조).
- e2e가 서버를 직접 띄움(:5310). 테스트 전용 공고 파일 경로(`E2E_LOCAL=1`+`OPPORTUNITIES_FIXTURE`, VERCEL 무시, 오류 시 실제 출처)로 어댑터 응답만 대체하고 후처리는 운영과 동일. 데이터 3벌: 고정 / 실데이터 스냅샷 `e2e/live-snapshot.json`(191건) / `LIVE_API=1` 실제 공공 API.
- 알림: 감시 분야를 "필요해요" 답한 분야로(`lib/alerts/core.ts`), 재조사로 찾은 새 공고를 받은 알림에 남김(`app/alerts/page.tsx`). e2e b에서 새 공고 2건 중 맞는 1건만 알림 → 30초 뒤 0건 → 받은 알림 유지 확인.
- 완화 안내를 바로 신청/확인 필요로 분리(`app/result/page.tsx`).
- Codex 3차 a71·b66·c61, 4차 a74·b69·c66(반려 유지, 사유: 주제 차별성). 4차 지적(LIVE_API 플래그, 실제 API 출처 단언, 스냅샷 재조사, 음수 안내) 반영 후 재채점은 안 받음.
- 검증: e2e 10/10, vitest 102, tsc·eslint·build 통과. 로컬 서버 http://localhost:5300(실데이터).

## 2026-11-22 사용자 흐름 점검·시나리오 e2e (Claude)
- 페르소나 4명(상경 취준생·부산 알바생·경기 사회초년생·대전 대학생)으로 실데이터 191건 흐름 점검 → `docs/사용자흐름_점검.md`.
- Codex 1차 평가 a55·b42·c28 반려(`.ai-sync/tasks/20261121T235217-codex/result.md`) → 수정: 지역은 버튼으로 한 번에 선택, 홈에서 고른 분야 재질문 제거, 홈 분야별 공고 수·0건 분야 비활성, 고령자·중장년 전용 주거·지원 공고 제외(`notForYouth`), 결과 ≤3건·0건이면 완화안 최대 3개(지역은 마지막, "확인 필요 포함" 표기), 결과 화면 "조건 고치기"(답별 예/아니오/모름), 0건이어도 알림 저장, 서버 저장 실패 시 재시도, 근무지가 다른 지역인 전국 채용은 뒤로(`components/result/sort.ts`).
- Codex 2차 평가 a67·b56·c55 여전히 반려(`.ai-sync/tasks/20261121T235908-codex/result.md`). 지적된 회귀(정렬 반대 동작, 제목 필터 오탐, 빈 응답 시 홈 전체 비활성, 저장 실패 후 재시도 불가) 수정.
- 시나리오 e2e `e2e/scenarios.test.mjs`(playwright-core + 시스템 Chrome, 고정 공고 `e2e/fixture.mjs`): a 바로 찾기 / b 조건 여러 번 고치고 알림 / c 적은 결과 완화 설명. 3/3 통과. LIVE=1 실데이터: a 통과, c는 부산 지원금이 21건이라 "적은 결과" 전제가 성립 안 함(데이터 의존).
- 검증: vitest 101 통과(1 skip), tsc·eslint·next build 통과. 로컬 서버 http://localhost:5300 (프로덕션 빌드).
- 남은 지적: 알림 저장 후 새 공고 주입→재조사 e2e 없음(서버 측 출처라 브라우저에서 가로챌 수 없음, 단위 테스트 `lib/server/flow.test.ts`로만 확인), "목록에 없어요"가 지역별 아니오를 여러 개 기록, 소득 질문 반복(150/140/100%).

## 2026-11-22 소개서 시각 검수 재개 (Codex)
- 승인된 셸로 렌더 이미지를 읽어 시각 검수 성공. API 각주 겹침 수정, 공식 API→규칙/Gemini와 Tavily→Exa→Jev 검색 보충 경로 분리.
- 서울 거주(예) → 무주택(아니오) → 나이(모름)에 따른 가상 공고 유지·제외 페이지 추가. 본문 10쪽 + 표지 + 별첨 = 총 12쪽.
- `scripts/refine_project_intro.py`와 별도 흐름도 PDF·PNG 생성. 검색 결과 자격조건이 비어 있는 한계 명시. 제출 전 팀 정보·공개 URL·사전 개발 이력·상세 이용조건 확인 필요.

단계: 환경 설정 → 아이데이션 → 기획 → 개발

## 2026-11-19 환경 설정
- `D:\KDT_AI_HACKATHON` 폴더 확인 (비어 있었음)
- 원격 저장소 `https://github.com/YougangKim/KDT_AI_HACKATHON` 클론 (빈 저장소, origin 연결됨)
- 이 로그 파일 생성

## 2026-11-19 ECC(Everything Claude Code) 설치 시도
- 공식 저장소 github.com/affaan-m/ECC 확인 (커밋 3f14a10, 2026-11-17), npm `ecc-universal@2.2.3` 의 repository 가 같은 저장소임을 확인
- 전제 조건 OK: Node v24.11.1, Git 2.55, Claude Code 2.1.296
- 계획: 프로젝트 범위, core 프로필, minimal 훅
- Claude 자동 권한 검사가 설치 명령(npx, claude plugin)을 막아서 사용자가 직접 실행함
- `--profile` 은 guided 모드에서 Kimi 전용이라 빼고 실행: `npx ecc-universal@2.2.3 install --guided --harness claude --claude-scope project --claude-hooks minimal`
- 확인: `ecc@ecc` v2.2.3, project 범위, enabled. 설정은 `.claude/settings.json` 에 저장됨
- 참고: 플러그인 package.json overrides 때문에 일부 npm 의존성은 설치되지 않았다는 안내가 나옴 (명령/스킬 사용엔 영향 없을 것으로 봄)
- 별도로 사용자 요청에 따라 예전 axhub 플러그인과 CLI 삭제 (프로젝트 외부 설정)
- ECC 명령은 `/ecc:plan` 처럼 접두사가 붙고, 로컬 Claude Code 입력창에서만 동작 (헤드리스 실행으로 413개 명령 로드 확인)

## 2026-11-19 작업 환경 규칙
- 기본 작업 환경: 로컬 `D:\KDT_AI_HACKATHON`
- GitHub push/커밋은 사용자가 요청할 때만: `CLAUDE.md` 에 규칙 명시, `.claude/settings.json` 에 git push 실행 전 확인(ask) 규칙 추가
- 자동 push 훅 없음 확인 (git hooks, 사용자 설정, ECC 훅)

## 2026-11-19 아이디어 정리 (`/ecc:plan 아이디어 정리`)
- 참고 자료: `해커톤 지침/` 대회 안내문·소개서 양식·AI 활용 기준 (기존 아이데이션 메모·research 문서는 폴더에 없었음)
- 결과: `아이디어_정리.md` 작성 — 요구사항 정리, 후보 5개(A 근로계약 점검 / B 청년정책 매칭 / C 전월세 위험 점검 / D 직무 갭 분석 / E 고정지출 정리), 예선 배점 기준 비교, A안 추천 + MVP 범위·일정·위험
- 상태: 사용자 확인 대기 (아이디어 선택, 팀 구성, 기술 스택, 참가 신청 여부)
- 커밋/푸시 안 함

## 2026-11-19 ChatGPT 대화 반영 아이디어 정리
- 공유 대화 "아이디어 실현가능성 평가" 읽음 (오버레이, 마이 알고리즘, 구인·알바 주기 리서치)
- 지침 대조: 프로토타입은 심사위원이 링크로 실행 가능해야 함 → 확장 단독 불가 / 이용약관 위반 데이터 금지 → 크롤링 대신 공공 API
- `아이디어_정리.md` 에 8절 추가: 후보 F(마이 알고리즘 구직 탐색 에이전트), A안과 비교
- 상태: 사용자 선택 대기. 커밋/푸시 안 함

## 2026-11-19 F안 확정, 데이터 접근 확인
- 사용자 F안(마이 알고리즘 구직 탐색 에이전트) 선택
- 공공 채용 API 조사 → 고용24는 기업회원 전용이라 개인 발급 어려움, 서울시 API는 샘플 호출 오류, 잡알리오(공공기관 채용)는 자동승인
- `아이디어_정리.md` 9절에 정리. 첫 적용 분야를 공공기관 채용·인턴으로 바꿀지 사용자 결정 대기
- 16:02 사용자 결정: 잡알리오(공공기관 채용·인턴)로 개발 시작 + 고용24 키 병행 신청. 11-21 정오까지 키 없으면 알바는 확장 계획으로만.

## 2026-11-21 청년 고민 딥서치 (주거·계약·교통·식사)
- 기사·통계·커뮤니티 글 검색해 고민 18개 정리, 빈도 50%·심각성 30%·해결난이도 20%로 점수화
- 결과: `research/청년고민_4대분야.md`. 빈도 1위 분야는 식사(균형 잡힌 식사 42.6%), 심각성 1위는 계약(전세사기 피해 76%가 2030), 계약 중 빈도 최고는 알바 근로계약(미작성 56.2%)

## 2026-11-21 Claude–Codex 공동 작업 설정
- `AI_HANDOFF.md`를 양쪽 에이전트가 공유하는 현재 상태판으로 생성
- `CLAUDE.md`와 `AGENTS.md`에 작업 전 상태 확인, 작업 후 인계 갱신, 동시 변경 보존 규칙 추가
- `WORKLOG.md`는 누적 이력 문서로 유지

## 2026-11-21 청년 고민 딥리서치 재작업 (주거·교통·구직·알바, ChatGPT 심층 리서치)
- 사용자 정정에 따라 범위를 주거·교통·구직·알바로 바꾸고 ChatGPT 심층 리서치로 수행 (출처 32개)
- `research/청년고민_4대분야.md`를 새 결과로 교체 (이전 주거·계약·교통·식사 버전 대체)
- 종합 1위: 구직 서류 반복 탈락·피드백 부재 4.50, 주거 총비용 판단 4.50. 알바 조건 맞는 알바 4.40, 알바 임금·수당 4.30
- 해결방안 판정: A 지원 의사결정 코파일럿 통과(권장, 잡알리오로 대체), B 통근시간 평가는 A 확장, C 주거 총비용·위험 점검 통과(자동승인 데이터), D 알바 급여 검산 조건부, E 알바 맞춤검색 반려(데이터·약관)
- GPT 원문 점수 2건 계산 오류 정정 (교통패스 3.60→3.10, 첫 알바 2.80→2.30)

## 2026-11-21 02:30 확장 아이디어 딥리서치 (ChatGPT 심층 리서치)
- 사용자: 취업은 레드오션, 수상작 패턴(비전문가 요청 → AI 표준 산출물 → 소상공인 일감)으로 생활·사회문제 전반 탐색 요청
- 결과는 `research/청년고민_4대분야.md` 7절. 숨고가 이미 사진 기반 AI 견적요청서를 운영 중이라 구조화 명세서와 공공데이터 결합이 차별점
- 추천: 원룸 이사·대형폐기물 통합 견적(대형폐기물 수수료 API 자동승인). 대안: 세입자 하자·수선 협의. 케이터링·굿즈 반려

## 2026-11-21 02:37 세입자 하자·수선 협의 데모 준비 (사용자 지시로 중단)
- 설계서 `plan/세입자하자협의_설계.md` 작성 (화면 5단계, 입출력 JSON, 문서 3종, 공공 API, 오류 처리, 시연 사진 목록)
- 시연 사진 4장 ChatGPT "사진 생성" 대화에서 생성, PC 저장은 안 함
- ChatGPT Sites 데모 생성은 약관 동의 전 단계에서 중단

## 2026-11-21 02:45 Claude→Codex 작업 위임 연결 (Claude)
- 기존: `.ai-sync/bridge.mjs` 훅으로 양쪽 최근 요청·응답 자동 공유 (Claude·Codex 모두 동작 확인)
- 추가: `.ai-sync/delegate.mjs` — `codex exec`/`claude -p`로 상대에게 1건 위임, `.ai-sync/tasks/<시각>-<대상>/request.md·result.md` 기록
- 검증: 읽기 전용 왕복 성공(약 20초). 쓰기 모드(workspace-write)는 Windows 샌드박스에서 파일 쓰기 실패 → 기본을 읽기 전용으로 두고 쓰기는 Claude가 적용
- 위임 테스트 중 Codex가 지적: AI_HANDOFF의 '확정 방향'(잡알리오 F안)과 '다음 작업'(주거 분야 추진)이 모순됨 → 사용자 확정 필요
- Codex→Claude 방향(`claude -p`)은 PC의 Claude CLI 로그인 만료("OAuth session expired")로 실패. 사용자가 터미널에서 `claude` 실행 후 `/login` 하면 동작 예정

## 2026-11-21 03:08 아이디어 인터뷰 (Claude)
- ECC product-lens 진단 질문으로 한 번에 한 질문 인터뷰 7회
- 사용자 체감 고통: 공고 반복 확인, 지원 준비 과정 복잡, 상관없는 공고 과다
- 반려: 세입자 하자(실효 약함), 이사 견적(불편 체감 없음), 알바·민간채용 모니터링(데이터·약관), 스펙 로드맵(정답 없는 영역), 실질 시급(계산기 수준)
- Codex 교차 검토: KDT 훈련과정·Q-Net 시험일정·NCS API 자동승인 가능, 워크넷·사람인 불가
- 결과 `plan/아이디어_인터뷰_평가.md`: 추천 G(청년 혜택·공고 지원 준비 에이전트, 81) vs A(근로계약 점검, 83), 사용자 결정 대기

## 2026-11-21 03:32 교차 평가 체계 + 2차 발산 인터뷰 (Claude)
- 사용자 지시: 점수는 만든 쪽이 아닌 상대 에이전트가 냉정하게. `.ai-sync/prompts/strict-review.md` 작성, `delegate.mjs --review` 추가, CLAUDE.md·AGENTS.md 규칙 추가 (브리지 매 요청 주입은 토큰 절약 위해 제거)
- Codex 채점: A 78 조건부, G 66·F 66 반려, 기존 반려 5건 타당
- 2차 인터뷰: 시험비·경기권 이동·AI 불안(반려). 화제 AI 서비스 자극 목록 `research/최근_화제_AI서비스_자극목록.md`
- 후보 H(모임 장소·코스 추천) Codex 51점 반려. 카카오 대중교통 1,000회/일·장소검색 100,000회/일 개인 가능 확인

## 2026-11-21 04:05 방향 확정·개발 착수 (Claude, 통합 스레드)
- 사용자 결정: 아키네이터형 게임 + 알림 앱, 분야(주거·알바·구직·청년주택·지원금·혜택) 확장형. 크롤링은 대회 규정(이용약관 위반 데이터 금지, 제3조·제8조)으로 배제
- API 조사 → `config/api_keys.csv`(20개, gitignore). ECC `/plan` → `.claude/plans/youth-akinator.plan.md`
- `web/` Next.js 15 + Tailwind 뼈대, @anthropic-ai/sdk·web-push·vitest 설치, 홈 화면, 빌드 통과
- 병렬 개발 계약 `web/CONTRACT.md` + `web/lib/types.ts` 고정, 코디네이터에 T1(엔진·게임)/T2(데이터·AI)/T3(결과·알림) 프롬프트 전달
- Codex 사용량 한도(05:34 해제 예정) → 이후 샘플 데이터 검토·교차 평가 분담

## 2026-11-21 04:20 T1 스무고개 엔진·플레이 화면 (Claude, T1 스레드)
- `web/lib/engine/index.ts`: CONTRACT 함수(startGame·nextQuestion·applyAnswer·getMatches·remaining) 구현. 답변에서 속성별 사실(나이 범위·지역·무주택 등)을 추론해 함의 판정(34세 이하=예 → 39세 이하 통과). 질문은 후보 조건에서 생성, 평균 탈락 비율×예/아니오 균형(엔트로피)×같은 속성 반복 감점으로 선택. 지역(region 배열)·관심 분야(domain)는 암묵 조건으로 추가. "모름"은 후보를 지우지 않고 unknowns→needs_check. 질문 문장 규칙 `phrase.ts`, 임시 픽스처 `__fixtures__/opportunities.ts`(16건)
- 테스트 `lib/engine/engine.test.ts` 10개(축소·함의·지역·반반 선택·모름·low 신뢰도·고갈) 통과
- `web/app/play/page.tsx` + `components/game/*`: 질문 1개 카드, 예/아니오/모르겠어요 버튼, 남은 후보 게이지(카운트다운·−N 팝업), 이전 질문 되돌리기, 10문항 또는 후보 5개 이하에서 `sessionStorage.lastResult` 저장 후 /result 이동. `/api/opportunities` 실패 시 픽스처 폴백(“임시 샘플 데이터” 배지)
- `web/app/play/phrase/route.ts`: 키가 있으면 lib/ai `phraseQuestion`으로 질문 문장 다듬기(“AI 생성 문장” 표시), 없으면 기본 문장
- npm test·npm run build 통과, 브라우저(모바일 폭)에서 픽스처로 끝까지 플레이→/result 이동 확인
- 남은 이슈(T0 담당): `app/globals.css`의 다크모드 블록이 body 글자색을 밝게 바꿔 다크모드 기기에서 홈·게임 글자가 안 보일 수 있음. 여러 스레드가 같은 `.next`로 dev/build를 동시에 돌리면 청크 404가 남(검증은 별도 복사본에서 함)

## 2026-11-21 04:15 T3 결과·알림·PWA (Claude, T3 스레드)
- `web/lib/alerts/`: `core.ts`(daysLeft·ddayLabel·findNew·findDeadlineSoon(D-3)·buildWatch·collectAlerts, '아니오' 답한 조건 공고 제외), `index.ts`(saveWatch·loadWatch·markSeen·알림 기록 localStorage "alertLog"·demoOpportunity), `client.ts`(SW 등록·권한·checkAlerts·runDemo·Web Push 테스트). 테스트 `alerts.test.ts` 8개 통과
- `app/result/page.tsx`(+ `?demo=1` 예시 결과), `components/result/MatchCard.tsx`(분야 아이콘·D-day·샘플 배지·왜 맞는지·확인 필요 원문·원문 링크·aiExplanation 시 "AI 생성"), `AlertBell.tsx`(앱 열 때 checkAlerts + 안 읽은 배지), `app/alerts/page.tsx`(저장 조건·받은 알림·권한·데모·푸시 테스트)
- `public/sw.js`(push·notificationclick), `public/manifest.json`, `app/api/push/route.ts`(GET 공개키/없으면 null, POST 테스트 발송, VAPID_PUBLIC_KEY·VAPID_PRIVATE_KEY·선택 VAPID_SUBJECT)
- 검증: npm run build 통과. 별도 복사본 서버로 결과→알림 저장→데모 → 인앱 배지·기록 확인, 실제 Chrome에서 SW 등록·활성 확인. OS 알림 표시는 사용자가 권한 허용해야 확인 가능(미확인)
- T0 요청: `public/icon-192.png`·`icon-512.png` 추가(manifest가 참조), `AlertBell`을 layout에 배치, globals.css 다크모드, package-lock 불일치(npm ci 실패). Codex 교차 평가는 한도 해제(05:34) 후 미실시

## 2026-11-21 04:50 / Claude(T2 데이터·AI)
- `web/data/samples/{housing,job,parttime,benefit,training,exam}.json` 58건(11·10·9·10·9·9). 실제 사업(LH 행복주택·청년월세·잡알리오 체험형 인턴·국민내일배움카드 KDT·Q-Net 등) 기반, 원문 URL, 마감 2026-11~12월, isSample=true. 모든 공고에 `interest`(분야) 조건 포함. 알바는 공공 아르바이트·근로장학 + "[예시 공고]" 2건
- `web/lib/sources/`: 어댑터 7개(lh-notice·myhome·jobalio·gov24·youthcenter·work24-training·qnet). env 키 있으면 호출·매핑, 없거나 실패·0건이면 분야별 샘플 폴백. 마감 지난 공고 제외, 1시간 메모리 캐시. 키 있으면 실데이터 자격요건 최대 15건을 Claude로 재구조화
- `web/lib/ai/`: `structureConditions`·`phraseQuestion`·`explainMatch`(ANTHROPIC_API_KEY 있으면 Claude, 실패·무키 시 정규식·템플릿 규칙), `aiEnabled()`
- `web/app/api/opportunities/route.ts`: `GET ?domains=` → Opportunity[]
- 검증: 단위 테스트 32개 통과, tsc 통과, 별도 복사본(D:\_t2_build)에서 next build 통과·키 없이 /api/opportunities 58건(6개 분야) 확인. web/.next는 다른 스레드 dev 서버가 써서 빌드 충돌
- `config/api_keys.csv` 확인필요 행 갱신: 온통청년 담당자 심사, 내일배움 훈련은 data.go.kr LINK형 → 고용24 별도 키(`WORK24_TRAINING_KEY`), LH 공지사항 404, 마이홈 상세페이지·엔드포인트 미확인, 상세페이지에 승인방식·트래픽 미표기
- 남은 것: 실키 발급 후 응답 필드 재확인(특히 마이홈·온통청년), Codex 교차 평가 미실시, 임시 폴더 D:\_t2_build 삭제(삭제 차단됨)

## 2026-11-21 05:20 통합 (Claude, 통합 스레드)
- T1·T2·T3 결과물 통합: globals.css 다크모드 블록 제거, public/icon-192·512.png 생성, layout 헤더에 AlertBell(결과 화면 중복 벨 제거), package-lock 재동기화(npm ci 통과)
- 엔진 보정: 청년이면 누구나 '예'인 나이 질문(만 19세 이하 이상·만 39세 이상 이하) 제외, 첫 질문 관심분야 가중
- 검증: npm test 50개 통과, npm run build 통과, 로컬 next start로 게임 7문항→결과 12건 확인
- 다음: Codex 앱 교차 평가(사용량 한도 해제 후 자동 실행), Vercel 배포, 실제 API 키 연결

## 2026-11-21 05:55 Codex 앱 교차 평가 + 버그 수정 (Claude, 통합 스레드)
- Codex `--review`: 54/100 반려(복지로·정부24 혜택알리미·카카오뱅크 지원금 찾기와 중복, 차별성 7/20, AI 활용 12/25). 개선안: 기회 조합·실행 순서 설계, 실제 공고 15~20건 검증, AI 해석 과정 화면 노출. 기록 `plan/아이디어_인터뷰_평가.md` 8절
- 수정: 알림 조건 매칭을 엔진 getMatches로 통일, /api/push 남용 방지, Condition.aiGenerated + 결과 카드 "AI 해석" 배지. npm test 50·build 통과
- 사용자 결정 대기: 실행 순서 설계 전환 여부

## 2026-11-21 09:00 Codex 재평가 + 서버 반복 리서치 구현 (Claude, 통합 스레드)
- 사용자 지적: 1차 평가가 핵심 가치(게임식 조건 입력 + 반복 리서치·알림)를 못 봄 → 확인 결과 요청 프롬프트가 "정책 추천 서비스 비교" 틀이었음. 핵심 가치 명시해 재평가: 컨셉 74 조건부 / 현재 구현 61 반려. 분야 횡단 단일 조건 알림 서비스는 확인 안 됨(`plan/아이디어_인터뷰_평가.md` 9절)
- 1순위 구현: 서버 저장소(Upstash REST, 없으면 메모리)·반복 조사(scanOne/scanAll)·/api/watch·/api/cron/scan·vercel.json 매일 09:00 KST·/alerts 반복 리서치 현황 패널·결과 화면 저장 시 서버 동기화. test 50·build 통과, 로컬 스모크 통과
- config/api_keys.csv에 Upstash·CRON_SECRET 행 추가

## 2026-11-21 09:45 시장조사·UX 레퍼런스 문서 (Claude, 시장조사·UX 스레드)
- `docs/market_research.md`: 경쟁·유사 서비스 13개 기능 비교(혜택알리미·복지멤버십·카카오뱅크·토스·웰로·온통청년·LH·마이홈·잡알리오·사람인·잡코리아·USAGov·GOV.UK), 기능 공백 매트릭스, 청년 수치(2024 청년 삶 실태조사 원문 PDF 대조: 필요 정책 주거 45.7%·일자리 33.5%, 공공임대 의향 71.7% vs 경험 7.0% 등), 리뷰 불만(확신도 표기), 위험·권고·검증 항목. ECC market-research 형식. 분야 횡단 단일 조건 반복 알림 서비스는 "확인 못함"
- `docs/ux_reference.md`: 원칙 5개(질문 반분할, 6문항, 0건 시 조건 완화, 즉시/요약 알림 선택, 알림 상한) + 화면별 와이어프레임(홈·질문·결과 요약/퍼널·병목 완화·저장·알림함 조사 기록·주간 리포트), P0/P1/P2
- 조사 분담: Codex `.ai-sync/tasks/20261121T003652-codex/result.md`(경쟁·리뷰·수치). 코드 수정 없음

## 2026-11-21 09:45 리서치형 기능 + ECC 스킬 적용 (Claude, 통합 스레드)
- 사용자 요청 반영: 조건 한 문장 요약, 최대 7문항·바로 결과 보기, 전체 공고 중 통과 %, 조건별 탈락 시각화, 병목 조건 완화 제안(타협 불가면 "꼭 지켜야 해요"), 반복 조사 기록 누적과 주간 리포트
- 분담: Codex = 퍼널·병목·요약 알고리즘(lib/insight/funnel.ts + 테스트 10개) 초안 → Claude 적용·교차 검토(요약 문장 구조 수정). Claude = 화면·흐름·서버 기록
- ECC: /plan(설계), tdd-workflow(퍼널 테스트, 시연 흐름 통합 테스트), e2e(내장 브라우저로 게임→결과→저장→재조사 확인; Playwright 미설치라 vitest 통합 테스트로 고정), code-review·security-review(Codex 위임 중)
- npm test 61·build 통과
- 09:55 사용자 요청(통과율 %, 조건 한 문장, 가벼운 사용감, 병목 시각화·완화 제안, 타협 불가는 질문으로) 반영: ux_reference 2-4-1(병목일 때만 "꼭 지켜야 해요" 묻기), 2-4-2(통과율·조사 실패 구분). Codex 교차 검토(`.ai-sync/tasks/20261121T004024-codex/result.md`) 반영: 인과 과장 문장 수정(공공임대 격차·주거+일자리), "매일 7곳/마감 변화" 문구를 현재 동작 기준으로 낮춤, 미대비 심사 질문 3개 답변안 추가, 마감 전 비현실 항목(알림 상한·서버 D-3 푸시·놓친 공고·의미적 완화) 분리

## 2026-11-21 10:05 보안 리뷰 반영 + UX 레퍼런스 반영 (Claude, 통합 스레드)
- ECC code-review·security-review(Codex 교차): 8건 중 7건 반영 — 소유자 토큰 인증, 서버 seenIds 병합(덮어쓰기 방지), 구독 endpoint 검증, cron 비밀값 필수(운영), seenIds 상한·인덱스 정리, 데모 모드·저장 동의 고지·삭제 API. 미반영: 동시 조사 원자화(데모 규모에서 위험 낮음)
- docs/ux_reference.md P0·P1 일부 반영, 구현 안 된 기능(마감 변화 감지·서버 D-3 푸시·주 3건 상한·즉시/주간 선택)은 화면 문구에서 제외
- npm test 63·build 통과

## 2026-11-21 10:15 웹 검색 보충 온오프 (Claude, 통합 스레드)
- Tavily·Exa 웹 검색으로 공고 보충하는 선택 기능 추가. 기본 OFF, 공공기관 도메인 한정 기본값(대회 규정: 약관 위반 데이터 금지), 본문 저장 없이 제목·링크·요약 200자, "웹 검색 결과" 배지로 공식 API와 구분, 공식 API와 같은 원문 URL은 중복 제외
- config/api_keys.csv에 TAVILY_API_KEY·EXA_API_KEY 행 추가. test 66·build 통과

## 2026-11-21 10:30 리서치·크롤링 도구 설치 (Claude, 도구 스레드)
- 설치: Scrapling 0.5.1(프로젝트 `.venv-tools/`, gitignore 추가, 스텔스 브라우저 미설치), agent-browser 0.43.0(npm 전역+Chrome for Testing), k-skill 9개(프로젝트 `.claude/skills`·`.agents/skills`, 청년 주거·지원·통계 관련만)
- 보류: insane-search(WAF·CAPTCHA 우회가 핵심 기능, gptaku-core 라우터 훅이 모든 세션에 우선 규칙 주입·차단 시 우회 재시도, setup이 Claude 대화 기록을 읽음), Firecrawl(키 없음)
- 앱 적용 판단: LH는 이미 공식 API 연결, k-skill-proxy 런타임 사용 금지, SH 공고 게시판만 기본 OFF 옵션 후보(robots 허용·약관 사람 확인 필요, 코드는 통합 스레드에 요청), 민간 플랫폼 금지. 상세 `docs/research_tools.md`
- web/ 코드 변경 없음

## 2026-11-21 10:25 제출 전 점검 1차 (Claude, 통합 스레드)
- ECC verification-loop: build·tsc·lint·test(66) 모두 PASS, 비밀값·console.log 없음. 린트 경고 3건(엔진 삼항 부수효과, 미사용 import) 수정
- 배포 검증 NOT PERFORMED: 사용자 계정(Vercel·Upstash)과 data.go.kr 키 필요
- `docs/demo_script.md` 시연 순서 초안(구현된 기능만)
- 11:00 사용자 결정으로 insane-search를 개발용으로 설치(프로젝트 범위, +gptaku-core). `.claude/settings.json`에 marketplace·enabledPlugins 추가, `env.GPTAKU_ROUTER=off`로 라우터·차단 우회 재시도 훅 끔(ECC 충돌 회피), 셋업 마커 사전 생성으로 전역 훅 설치·대화 기록 읽기 생략. 대회 앱 런타임 미사용

## 2026-11-21 10:58 에이전트 한도 대응 (Claude, 통합 스레드)
- delegate.mjs: 한도 오류 감지 → 다른 에이전트 폴백, 둘 다 한도면 대기열 저장·리셋 시각 파싱·작업 스케줄러 예약(AI-Sync-Resume). --review는 폴백 금지(자기 평가 방지)
- resume.mjs: 리셋 지난 대기 항목 재실행, 로그 .ai-sync/queue/resume.log
- 모의 한도(AI_SYNC_FAKE_LIMIT) 테스트: codex 한도→claude 폴백 성공, 둘 다 한도→대기열, review→폴백 안 함, 대기열 재실행 성공(codex 실제 실행)
- 작업 스케줄러 등록은 자동 모드 권한에서 차단 → 사용자 승인 필요
- AI_HANDOFF "다음 작업"을 현재 기준으로 재정리
- 11:45 SH 약관·공식 RSS 확인, 브라우저로 약관·RSS·robots 열어 줌. 결론: 크롤링 대신 공식 RSS(기본 OFF, 제목·링크·날짜만). docs/research_tools.md

## 2026-11-21 11:00 사용자 할 일 정리·업로드 준비·제출 초안 (Claude, 통합 스레드)
- docs/사용자_할일.md: 모든 스레드의 사용자 작업 15개(필수/선택·소요·방법·전달 형식, 완료 체크)
- 작업 스케줄러 자동 등록이 자동 모드에서 차단 → register-resume-task.ps1(30분 주기) 사용자 1회 실행 방식으로 변경
- GitHub 업로드: 사용자 허락, 커밋 명령이 자동 모드에서 차단 → .gitignore 보강 후 사용자 실행 명령 안내
- 제출 초안: docs/제출_소개서_초안.md(양식 순서), docs/제출_AI활용내역_초안.md(1,736자)

## 2026-11-21 11:10 SH 공식 RSS + 미반영 목록 (Claude, 통합 스레드)
- 사용자 승인으로 SH 공식 RSS 어댑터 추가(기본 OFF). 실제 피드 확인: RSS 리더 UA 필요, EUC-KR, 29건 중 모집 공고만 필터. test 70·build 통과
- docs/미반영_목록.md: 미구현 기능(우선순위·출처)과 사용자 미완료 작업

## 2026-11-21 12:50 마감 변경·임박 감지 + 중복 제거 (Claude, 통합 스레드)
- 작업 스케줄러(사용자 등록)가 10:44 대기열 테스트 작업을 자동 재실행 완료. GitHub 푸시(9b0f8d5) 확인
- 반복 조사에 마감일 변경·D-3 임박(공고당 1회) 감지 추가, 푸시는 "새 공고·마감 변경·마감 임박" 한 건으로 묶음
- 출처 간 같은 공고 제목 정규화로 하나만 남김(공식 API > RSS > 웹 검색 > 샘플)
- test 74·build·lint 통과. 미반영 목록·사용자 할 일 체크 갱신

## 2026-11-21 13:35 데모 확인용 제공 + 판정 개선 (Claude, 통합 스레드)
- 사용자 요청: 배포 전 UI를 예시 데이터로 확인. localhost:3400에 최신 빌드, 화면 5장 캡처, docs/데모_확인방법.md
- 화면 점검 중 발견: 같은 답에서 "바로 신청 0개" → 원인 3가지(관심 분야 미질문, 만 19세 이상, 취업상태 추론) 수정 → 22개. 테스트 2개 추가(총 76)
- 개선 후보: 지역 질문이 도시 하나씩 나옴

## 2026-11-21 14:55 공모전 보고서 초안 (Claude, 통합 스레드)
- docs/제출_보고서_초안.md: 대회 양식 순서(표지·요약·01~08·별첨)와 AI 활용내역(1,917자) 통합 초안, 빈칸 목록 7개
- Codex --review: 문서 기준 65/100 반려. 과장·불일치 문장 7개 수정 반영, 남은 감점은 배포·실데이터·AI 구조화 정확도 증거

## 2026-11-21 22:40 결과 흐름 UX 개편 (Claude, 통합 스레드)
- 사용자 요청 4가지: 홈 관심사 선택, 끝나자마자 공고 3개 + 더보기/추가 질문, 분석 별도 페이지, 분석 화면 단답형 리디자인
- 확인: 3분야 선택 → 30개 결과 → 추가 질문 2개로 19개까지 좁힘, 분석 페이지 표시. test 77·build 통과. 데모 localhost:3700

## 2026-11-21 22:50 취업 상태 오탈락 수정 (Claude)
- 사용자 지적: "알바 중"이라고 답하면 미취업자 대상 공고가 전부 제외됨(그만두거나 이직할 사람도 대상일 수 있음)
- `web/lib/engine/index.ts` `lenient()`: 맞지 않아도 탈락 대신 "확인 필요"로 남길 조건 = 취업 상태 전부, 우대·우선·가능·무관·다름 문구, confidence low, 기준중위소득이 아닌 소득 기준
- 점검 결과 그대로 둔 하드 조건: 나이, 지역, 무주택, 1인 가구, 기준중위소득, 관심 분야 아니오
- 테스트 4개 추가(`lib/engine/youth.test.ts`), test 81·build·lint 통과, 데모 http://localhost:3800

## 2026-11-21 23:05 Vercel 배포·data.go.kr 신청 안내 (Claude)
- data.go.kr 개발계정 승인 5개: LH 분양임대공고문(15058530), 마이홈 공공주택 모집공고(15108420), 잡알리오 공공기관 채용(15125273), 공공서비스(혜택)(15113968), 국가자격 시험일정(15074408). 키는 사용자가 `config/api_keys.csv`에 직접 입력 예정
- 온통청년(15143273)은 LINK형이라 youthcenter.go.kr에서 별도 가입·신청 필요, 내일배움은 고용24 별도 키
- Vercel: 기존 이메일 계정(kimyk 팀, Hobby)에 GitHub 연결·GitHub App 설치, 프로젝트 `kdt_ai_hackathon-web`(Root=web, 브랜치 claude/project-thread-pm1ii1) 생성. 빌드 성공했으나 Next.js 15.5.4 취약 버전이라 Vercel이 배포 차단 → `next`·`eslint-config-next`를 15.5.29로 올린 뒤 푸시 필요(사용자 푸시 보류)

## 2026-11-21 23:15 민간 API 조사 (Claude, 조사 전용·web/ 미수정)
- 결과 `docs/민간API_조사.md`. 추천 1: 청약홈 분양정보(data.go.kr 15098547, 자동승인, 민영 APT·무순위/잔여·오피스텔/민간임대·공공지원 민간임대, odcloud 형식이라 gov24.ts와 같은 방식). 추천 2: 사람인 API(심사 승인·주말이라 마감 전 불확실 → 지금 신청, 어댑터 기본 OFF)
- 제외: 잡코리아(약관상 개인·프로젝트 불승인), 알바몬·알바천국(공개 API 없음), 원티드(사업자번호 필수·3영업일), 직방·다방·피터팬(공개 API 없음, 크롤링뿐). ODsay는 무료 일 30회라 보류

## 2026-11-21 23:20 실데이터 점검 준비 + Next.js 보안 패치 (Claude)
- `web/scripts/check-sources.mjs`: CSV의 DATA_GO_KR_KEY로 5개 출처(LH·마이홈·잡알리오·공공서비스·Q-Net) 직접 호출해 상태·건수·필드명만 출력, `--env`면 `web/.env.local` 기록. 현재 CSV 키 칸이 비어 있어 미실행
- Vercel 배포 차단 대응: next·eslint-config-next 15.5.4 → 15.5.29, sharp 취약점 audit fix. 남은 audit: next 내장 postcss(빌드 시 CSS 처리, 16.x 업그레이드 필요라 보류). test 81·build·lint 통과
- 데모 서버 http://localhost:3900 (3800 포트 잔류)

## 2026-11-21 23:35 청약홈·사람인 어댑터 + 키 입력 파일 (Claude)
- `web/lib/sources/applyhome.ts`: 청약홈 분양정보(APT·무순위·오피스텔/민간임대), DATA_GO_KR_KEY 공용(별도 활용신청), 일부 실패 허용, 무주택은 low 신뢰도 힌트
- `web/lib/sources/saramin.ts`: 사람인 채용(신입), 기본 OFF(`SARAMIN_ENABLED=1`+`SARAMIN_KEY`), "사람인 제공" 출처 표기
- 테스트 `lib/sources/private.test.ts`(5). test 86·build·lint 통과
- 키 입력은 기존 `config/api_keys.csv`(사용자 요청). 엑셀 한글 깨짐 방지로 UTF-8 BOM 추가. `web/scripts/check-sources.mjs`가 CSV(UTF-8/cp949 모두)를 읽고 `--env`로 `web/.env.local`에 반영. keys.txt는 만들었다가 삭제
- 데모 서버 http://localhost:4000

## 2026-11-21 23:55 실데이터 연결 확인 (Claude)
- 사용자 CSV 입력 → `web/.env.local` 반영(DATA_GO_KR_KEY), VAPID 키·CRON_SECRET 로컬 생성(값은 기록 안 함)
- 실호출: LH 50·마이홈 50·잡알리오 50·공공서비스 50·Q-Net 75건 OK, 청약홈 401(활용신청 전)
- 버그: 중복 제거가 같은 출처의 회차만 다른 공고(Q-Net 75→2)까지 합침 → 같은 출처끼리는 합치지 않게 수정(+테스트). 앱 목록 174건(실데이터 156 + 알바·국비 샘플 18)
- 브라우저 확인: 주거+채용 선택 시 후보 104개, 결과 57개(바로 신청 43) 실공고 표시. 데모 http://localhost:4400. test 87·build·lint 통과

## 2026-11-22 00:10 Tavily·Exa 웹 검색 실동작 확인 (Claude)
- CSV의 TAVILY·EXA 키를 `web/.env.local`에 반영, `WEB_SEARCH_ENABLED=1`
- Tavily: HTTP 432 "plan usage limit 초과"(계정 한도) → 0건. Exa: 정상(분야별 5건)
- 수정 `lib/sources/websearch.ts`: Tavily 실패 시 Exa로 자동 전환, 게시판·메뉴·일정 안내 페이지 제목 제외(`isPostingTitle`), 제목의 사이트명 꼬리 제거. 필터 전 30건 중 대부분 목록 페이지 → 필터 후 2건(청년안심주택 모집공고, 국가기술자격검정 시행공고)
- test 89·build·lint 통과. 데모 http://localhost:4600

## 2026-11-22 00:30 Gemini·Jev AI 연결 (Claude)
- `web/lib/ai/index.ts`: ANTHROPIC 키 없고 GEMINI_API_KEY 있으면 Gemini generateContent(REST, `x-goog-api-key`, 기본 모델 `gemini-3.5-flash-lite`, `GEMINI_MODEL`로 변경)로 자격요건 구조화·질문 문장·맞는 이유. 실패 시 규칙 기반. `aiEnabled()`가 Gemini도 인정
- `web/lib/ai/jev.ts`: TypeSafe Jev Noul(예/아니오 확률) `judgeYes`. JEV_API_KEY 있을 때만. 웹 검색 결과가 개별 모집 공고인지 판단해 0.5 미만 제외(`lib/sources/websearch.ts` keepPostings)
- 근거 문서: docs.typesafe.ai/api/system-one.md, aistudio.google.com/docs/models. Gemini 무료 모델 id는 문서에 명시 없음 → 키 받으면 실호출로 확인 필요
- 테스트 `lib/ai/providers.test.ts`(4). test 93·build·lint 통과. CSV 26·27행(GEMINI·JEV) 추가는 엑셀이 파일을 열고 있어 실패 → 엑셀 닫은 뒤 추가

## 2026-11-22 00:45 CSV 정리·Upstash 변수명·청약홈 실데이터 (Claude)
- `config/api_keys.csv` 정리(사용자 요청): 키 입력된 행(1·3·6·10·15·23·24)과 앞으로 넣을 행(8 사람인·11 온통청년·14 고용24 훈련·26 Gemini·27 Jev)만 남김. 입력된 키 3종 값 보존 확인, UTF-8 BOM 유지. 백업 `config/api_keys.20261121.backup.csv`(gitignore)
- `lib/server/store.ts`: Vercel Upstash 연동 변수 `KV_REST_API_URL/TOKEN` 폴백
- 청약홈 활용신청 반영됨: 실호출 34건(APT 21·무순위 9·오피스텔/민간임대 4), 마감·지역 모두 채워짐. 데모 http://localhost:4700

- 00:58 CSV 14행(고용24 훈련과정, 기업회원 전용이라 발급 불가) 삭제(사용자 요청). 국비 과정은 키가 없으면 예시 데이터로 자동 표시(코드 변경 없음)

## 2026-11-22 01:15 Gemini 실동작 + AI 안전장치 (Claude)
- CSV 14행(고용24 훈련과정) 삭제 완료, 다른 키 보존 확인. 국비 과정은 예시 데이터 유지
- Gemini 키 반영: `gemini-3.5-flash-lite` 200 OK. 자격요건 3문장 구조화가 규칙 결과와 일치, 질문 문장 생성 OK
- 실데이터 AI 해석에서 오류 발견: 정년(만 60세 미만)→나이 상한, "세종학당재단"→세종 거주, "자립준비청년"→무주택, 나이 0세 이상 → `plausibleAiCondition`으로 버림(`lib/sources/index.ts`, 테스트 추가)
- Gemini 무료 등급 429(동시 15건) → 동시 2건으로 제한. 그래도 첫 로딩 약 24초·일부 429는 규칙 기반 폴백. 이후 1시간 캐시
- 청약홈 API가 00시 이후 totalCount 0 반환(키 문제 아님, 일시적 추정) → 재확인 필요
- test 94·build·lint 통과. 데모 http://localhost:4900

## 2026-11-22 01:50 개발 재개: Jev 확인·로딩 개선·시연 구분 (Claude)
- Jev 실호출 OK(jev-1.14.0): "청년안심주택 모집공고" 0.91, "공지사항 게시판 목록" 0.05. 웹 검색 필터에 사용 중
- 청약홈 재확인: 정상(21건, 자정 직후 일시 0건이었음)
- 첫 로딩 24초 → 3초: 화면 요청은 AI 해석을 기다리지 않고 뒤에서 해석(`enrichWithAi` wait 옵션, 중복 호출 방지), 반복 조사(`lib/server/scan.ts`)는 기다림
- AI 조건 중복 제거(`parseConditionsJson`)
- 홈: 알바·국비 과정에 "예시 데이터" 표시, 출처 문구를 실시간 출처 기준으로 수정
- `docs/배포_환경변수.md`: Vercel 필수/권장/선택 변수 목록
- AI 정확도: `web/scripts/ai-eval.test.ts`(AI_EVAL=1일 때만)로 실공고 20건 AI·규칙 결과 `plan/ai_eval_data.json` 생성 → Codex 채점 요청 중
- test 94(+1 skip)·build·lint 통과. 데모 http://localhost:5100

## 2026-11-22 02:10 AI 정확도 근거 (Claude, 채점은 Codex)
- 1차 채점(`.ai-sync/tasks/20261121T154503-codex/`): AI 정밀도 69.8%·재현율 78.9%, 규칙 91.4%·84.2% → 앱을 규칙 우선+AI 보완으로 변경, 규칙 "~40세 미만" 경계 오류·AI 소득→취업상태 오해 수정, AI 중복 제거
- 재채점(`.ai-sync/tasks/20261121T154839-codex/`): 합성(앱 방식) 정밀도 94.6%(35/37)·재현율 92.1%(35/38). 보고서 07절에 표 반영
- test 95(+1 skip)·build·lint 통과
## 2026-11-22 01:36 프로젝트 소개서 PDF (Codex)
- `AGENTS.md`, `CLAUDE.md`, `AI_HANDOFF.md`, 기존 docs와 대회 양식·안내문·AI 활용 및 출처 기준 PDF를 대조했다.
- `scripts/build_project_intro.py`로 A4 가로 11쪽 소개서 생성: 표지, 프로젝트 요약, 01~08, 지정 별첨. 통계 그래프, 사용자 흐름·Happy Path, 인프라 구조, 공공 API별 수집→Opportunity 공통화→규칙 우선/Gemini 보완→질문별 예·아니오·모름 필터→Vercel Cron·Upstash·Web Push 흐름을 포함했다.
- 결과물: `output/pdf/찾아줄게_프로젝트소개서_20261122.pdf`. 저장소에 없는 팀 정보·공개 URL·사전 개발/타 공모전 확인은 빨간 입력 필요 항목으로 남겼다.
- 검증: Vitest 95개 통과(+AI 평가 1개 skip), ESLint 통과, Next.js production build 통과. PDF 11쪽 PNG 렌더, 빈 페이지 없음, 모든 문자 bbox 페이지 경계 안, 한글 추출 확인. 로컬 이미지 뷰어와 브라우저 미리보기는 Windows ACL helper 오류로 열리지 않아 좌표·렌더 기반으로 검수했다.

## 2026-11-22 소개서 디자인 개정 (Codex)
- 사용자 요청에 따라 impeccable typeset 지침과 독립 타이포그래피 검토를 반영. Noto Sans KR 3개 굵기, 16:9, 제목 30pt, 일관된 여백·색상·정렬로 재구성. 상세 출처는 별첨으로 옮기고 본문 10쪽 유지.
- 최신 제작 스크립트 `scripts/build_intro_designed.py`. 소개서 15쪽(표지+본문 10+별첨 4), API 연계/질문 필터 별도 2쪽 PDF 및 PNG 갱신.
- 공식 API 6종 이용조건 확인, SDK 라이선스 수정, 통계 잠정치 및 소표본 평가 한계 표기. Tavily 크레딧 한도로 Exa 사용.
- 15쪽 전체 렌더 시각 확인 및 pdfplumber 문자 경계 검사 통과. 기존 테스트 기록은 날짜와 함께 인용; 문서 작업이므로 앱 테스트 재실행·앱 수정·배포·커밋·푸시 없음.
- 남음: 팀명·팀원·역할, 사전 개발/타 공모전 이력, 공개 URL, 운영 Cron/앱 종료 푸시 검증.

## 2026-11-22 서비스 예시 데이터 제거 (Codex)
- API 실패·0건 샘플 대체, 게임 fixture 대체, demo 결과, 가상 알림 생성 경로 제거. 기존 세션 결과와 알림 기록의 샘플도 표시에서 제외. 테스트 데이터는 보존하고 런타임 import 제거.
- sampleResult.ts 삭제(기존 Git 추적본에서 복구 가능). 홈 안내 수정, 조회 가능한 공고가 없을 때 빈 상태·재조회 경로 제공. React 검토 지침으로 hook 순서와 빈 상태 확인.
- sources 회귀 테스트 수정·lastResult 테스트 2개 추가: 97개 통과·1개 제외. 최종 빌드로 타입·린트 재검증. 배포·커밋·푸시 없음.
- Jev는 웹 검색 후보의 개별 모집 공고 여부(p≥0.5), Gemini는 규칙 미추출 속성 보완과 질문 문장 작성에 사용. 최종 자격 필터는 규칙 엔진이며, 웹 검색 공고의 자격조건 추출은 미구현.
- 소개서 양식 항목 복원·명사형 제목/문어체 설명 반영 완료, 최신 렌더의 시각 검수는 후속 필요.

## 2026-11-22 09:05 GitHub 푸시·배포 확인 (Claude, 사용자 승인 "푸시해")
- 커밋 a7fe940 → origin/claude/project-thread-pm1ii1. 제외: config/api_keys.csv·백업·web/.env.local(gitignore 확인), tmp/(대회 문서 사본)·output/(소개서 PDF 초안)·__pycache__ gitignore 추가, Codex의 .codex 훅 변경은 커밋 안 함. 커밋 diff 키 패턴 검사 통과
- Vercel 자동 배포 성공(상태 success). 운영 주소 https://kdtaihackathon-web.vercel.app 비로그인 200, 화면 최신 반영. 단 /api/opportunities 0건 → Vercel에 DATA_GO_KR_KEY 등 환경변수 미입력으로 추정(현재 코드는 예시 데이터 폴백 없음). 미리보기 주소는 Vercel 로그인 보호
- 보고서 07절·요약에 배포 링크 반영

## 2026-11-22 11:30 배포 사이트 실검증 (Claude)
- 사용자가 Vercel 환경변수 저장(Import .env, Secret 유형) → 기록 커밋 575845f 푸시로 재배포(success)
- https://kdtaihackathon-web.vercel.app/api/opportunities 191건 실데이터(LH 50·마이홈 4·청약홈 34·잡알리오 50·공공서비스 46·Q-Net 6·웹검색 1)
- 브라우저: 주거+채용 → 2문항 → 결과 66개(바로 신청 44) 실공고, 알림 저장 → 알림함 "매일 오전 9시 자동 조사"(Upstash 연결 확인, 데모 모드 아님), 마감 임박 9건, "지금 다시 조사하기" 서버 조사 성공(138건 중 66건 통과). 테스트용 조건 1건이 운영 저장소에 남아 있음(알림함 "조건 지우기"로 삭제 가능)
- 미검증: 앱 종료 상태 Web Push(내장 브라우저는 알림 차단) → 사용자 크롬에서 알림 허용 후 확인 필요. 잡알리오는 근무지를 자격으로 보지 않아(의도) 경기 답변에도 타 지역 채용이 남음

## 2026-11-22 13:10 사용성 검수 절차·기준선 (Claude, 코드 수정 없음)
- 리서치: 과업 성공률·시간·오류율, Nielsen 휴리스틱, 인지적 워크스루, SUS(평균 68) 중 앱에 맞게 선택 → `docs/검수_절차.md`
- 자동 검수 `e2e/audit-live.mjs`(배포 사이트를 실제 Chrome으로, 페르소나 3명, 17항목, 결과 `e2e/artifacts/audit-*.json`). 실행 `cd e2e && node audit-live.mjs`
- 배포 기준선 `docs/검수_결과_20261122.md`: 5/17 통과, T1 3/3·T2 3/3·T3 0/3. 사용자 지적 6개 중 5개 재현(분야 다중 선택은 배포 홈에서 정상). 새로 찾음: 더보기 후 "좁히기" 버튼 사라짐, 부정한 지역 공고 1위, 0건 분야가 조회 실패 문구, 링크 형식 오류 3·루트 링크 17, 마감일 없음 36. 질문 단조로움의 근본 원인은 공고 조건 분포(지역 123·나이 97, 소득 5·1인 4)
- 배포본이 로컬 미배포 수정보다 오래됨(지역 일괄 선택·분야 재질문 제거 등 미반영)
- Codex 교차 평가 `.ai-sync/tasks/20261122T040249-codex/result.md`: 앱 34/100 반려, 검수 절차 64/100 조건부 → A10·A1·A4·A12 판정 보강 반영

## 2026-11-23 00:25 디자인 개편 "My News — 나만의 소식통" (Claude 적용, Codex 구현안)
- 브랜드: 마이뉴스 → My News / 나만의 소식통(화면·manifest·푸시·SW). SVG 로고 `web/components/brand/Logo.tsx`, `web/public/icon.svg`, PNG 192/512 재생성
- 스플래시 `web/components/brand/Splash.tsx`(세션당 1회 ~1.1초, reduced-motion 0.3초), 디자인 토큰(globals.css), 질문 카드·신호 게이지·칩·결과 카드 정돈
- `next.config.ts` distDir를 `NEXT_DIST_DIR`로 바꿀 수 있게 함(다른 스레드 next dev와 .next 충돌 회피, 빌드는 `.next-prod`)
- 검증: vitest 145·tsc·eslint·build·e2e 10/10 통과. 캡처 `docs/screenshots/design/1~6`

- 2026-11-23 02:20 페르소나 검수 준비(취업 준비+알바 병행 구직자): 설정·체크리스트·기록 양식 `docs/persona_audit/취업준비_알바병행_구직자.md`(Codex 초안 `.ai-sync/tasks/20261122T171357-codex/`). 브라우저 검수는 수정 스레드 완료 신호 후 시작

## 2026-11-23 10:30 Codex — 공고 원문 기반 새 질문 생성
- 고정 facet 문구 생성만 하던 추가 질문을 별도 API로 교체. 원문 차이에서 AI가 새 질문·버튼·매칭 구절 생성, 검증된 후보에 topic 선호 필터 연결. 미분류 보존, 이전 답변 전달, 모름·되돌리기·생성 실패 재시도 처리.
- Groq 기본 모델404·OpenRouter 무료모델404·CF 폐기410·Gemini 한도429 진단. 기존 Groq 계정 모델 목록 확인 후 실제 성공한 openai/gpt-oss-120b/low reasoning로 기본 설정 변경. 키 변경/유료 플랜 전환 없음. 진단용 임시 스크립트 제거.
- 검증: 단위180통과/1skip, .next-prod 빌드 성공, :3950 실제 새 질문 생성 성공(가상 공고), 별도 브라우저 흐름 테스트 통과(새 질문 응답 모킹). 전체 기존 E2E와 17항목 총괄 검수 완료 아님. 기존 4스레드 검증 보류 유지.
- 이전부터 진행한 정중체·슬라이더 수정도 로컬에 남아 있으며 후속 통합 검수 필요. 채용 근무지 상세 수집/지도·회사별 묶음·분석 나머지 요청 미완료. AI_HANDOFF에 구체 후속 기록. 배포/커밋/푸시 없음.

## 2026-11-23 Codex — 현재 구현 보존 및 지정 카드 제거
- Claude b9feb5f 및 미커밋 저장 보완을 확인. 현재 파일 단위196통과/1skip·.next-prod 빌드 성공. 전체 E2E 재실행 없음. 기존 3950 개발 서버 유지.
- 사용자가 추가 수정을 최소화하도록 요청하여 임의 변경 보류. 이후 명시 요청한 AnalysisView.tsx의 '조건 수정 제안' 카드만 삭제. tsc --noEmit 통과. 다른 기능·정책 변경, 커밋·푸시·배포 없음.

- 11/23 18:40 Claude: 신청 준비(/prepare) 페이지 설계만 작성(코드 미수정, 사용자 지시). `docs/설계/신청준비_페이지_설계.md`(섹션 순서·데이터 출처·유형 판별·유형별 체크리스트/순서/초안·답→문장 변환·대상 경고·제목 정리), `docs/설계/신청준비_초안예시_프롬프트.md`(유형별 예시 문장·나쁜 예·무료 AI 공용 프롬프트·checkDraft), 목업 `docs/설계/신청준비_목업/00~03.png`(mockup.html). Codex 교차 평가는 한도로 대기열(`.ai-sync/queue/20261123T092807-codex-3bjz.json`, 20:15 리셋 후 재개) → 결과 나오면 반영.

- 11/24 Claude(조율)·Codex(조사·초안): AI 트래픽 대응 현황·전환 설계·비용 최소화 문서 `docs/설계/AI_트래픽_대응/AI_트래픽_대응_설계.md` + 다이어그램 4장(01~04 png). 앱 코드 미수정. 근거 `.ai-sync/tasks/20261123T160429-codex`, `20261123T160632-codex`.
- 11/24 Claude(조율)·Codex(조사): AI 호출 9곳 프롬프트 원문·입출력 형식 정리 `docs/설계/AI_트래픽_대응/AI_프롬프트_입출력.md`. 코드 미수정.
- 11/24 Claude(조율)·Codex(조사): AI 입출력 토큰 최소화 + 질문 승격 풀 설계 `docs/설계/AI_트래픽_대응/AI_토큰_최소화.md`, 05_질문승격풀.png. 코드 미수정.
- 11/24 Claude(조율)·Codex(구현 패치): AI 토큰 절감·질문 승격 풀 적용. 질문 3개 라우트 1일 캐시(원본 저장·꺼낼 때 현재 요청으로 재검증)·동시 중복 방지·공급자별 usage 집계(/api/ai-status), 질문 승격 풀(/api/question-feedback 집계, 승격 기준 노출200·응답률65%·모름25%↓ 등, 10% 탐색, 응답에 feedbackKey만 추가), 화면 피드백 전송. 프롬프트·maxTokens·입력 상한 유지. 검증: vitest 212, tsc, build, E2E 14 통과, 변경 전후 비교(e2e/ai-compare.mjs, 구조 동일·재요청 약 10ms), Codex 리뷰 1차 배포불가 4건 수정 후 배포 가능(.ai-sync/tasks/20261123T170344-codex).

- 11/24 02:25 Claude: 신청 준비 설계 로컬 적용(사용자 요청). 새 `web/lib/prep/{profile,kind,draft}.ts`, `lib/prep/index.ts`·`prep.test.ts`(15), `app/prepare/page.tsx`(대상 배너·비교 표·한눈에·출처 배지 체크리스트·날짜 순서·유형별 초안·warn이면 초안 보류), `app/api/prep/route.ts`(사실 문장만 전송, 공용 프롬프트+다른 분야 예시 1쌍, checkDraft 통과분만 교체). 전체 test 229 통과·tsc·lint·.next-prod 빌드 통과, 3950 서버(next start, NEXT_DIST_DIR=.next-prod) 재시작. 화면 캡처 `docs/설계/신청준비_목업/적용_01·02.png`. 커밋·푸시 안 함. Codex 교차 평가는 대기열 `20261123T111457-codex-fsm3.json`(11/24 20:15 리셋 후).

- 2026-11-24 무료 AI 체인·토큰 확보 조사 문서 `docs/설계/AI_트래픽_대응/무료AI_토큰확보_조사.md`. 조사 Codex(`.ai-sync/tasks/20261123T171842-codex/`), Claude가 Groq AUP·Z.AI 가격 원문 재확인, 무료 AI 묶음 MCP 게이트웨이(freellmpool, freellmapi, free-llm-hub 등) 추가 평가. 코드 수정 없음.

- 2026-11-24 14:58 GitHub Actions 'Scan saved watches' 실패 조사: GitHub 저장소에 `CRON_SECRET` 시크릿이 없어 빈 토큰으로 호출 → 배포 서버 `/api/cron/scan`이 401 반환(코드·서버 문제 아님). 해결: 사용자가 Vercel의 CRON_SECRET과 같은 값을 GitHub Actions 시크릿으로 등록. 워크플로 파일 변경 없음

- 2026-11-24 Jev(판단 전용 초경량 모델) 활용 설계 `docs/설계/AI_트래픽_대응/Jev_판단모델_토큰절감.md`. 한국어 공고 3건 실측(시도·분야 3/3, 나이 판단은 애매 → 숫자는 규칙 유지). 코드 미수정.

## 2026-11-24 15:00 채용 결과 정책 공고·지역 핀 수정 (Claude, Codex 재현)

11/24 15:00 Claude(Codex 재현 초안 `.ai-sync/tasks/20261124T055210-codex/result.md` 검토 후 일부 적용): 채용 결과 정책 공고 혼입·근거 없는 지역 핀 수정. 온통청년 일자리·취업·창업 분류 job→benefit(`youthcenter.ts`), 채용·알바는 시·도 중심 좌표 fallback 없음·잡알리오 기관명 단독(본사) 재검색 제거(`geo/geocode.ts`), 채용 주소 추출은 '근무지' 문장만·근거 없으면 AI도 호출 안 함(`geo/extract.ts`, place-v3), 채용 지역 추론에서 기관명 제외·저장 풀의 채용 region 좌표 제거(`sources/index.ts` dropRecruitRegionPin). 반려: 근무지 place 없는 채용의 원문 region 전부 삭제(원문 근무지역 필드까지 지워 지역 필터 회귀), isOpenRecruit 키워드 삭제(정책 분리 효과 없음), 사람인 place 추가(요청 밖). test 241·tsc·lint·.next-prod 빌드 통과. 커밋·푸시 안 함, 3950 서버 재시작 안 함.


- 11/24 15:20 Claude: 신청 준비 개편 Codex 교차 평가 32/60 '수정 후 배포'(`.ai-sync/tasks/20261124T055254-codex/result.md`) → 확인 필요는 check(AI 버튼 없음), warn·block 복사에서 초안 제외, AI는 동의 버튼 뒤(위치 미전송), 지역 불일치(별칭 포함)·요약 대상 키워드·마감 경과 판정, AI 팁 제거, AI 초안은 문장 추가·길이·새 낱말 검사. 재검증(`.ai-sync/tasks/` 최신) 지적 반영. test 243 통과·tsc·lint·빌드 통과. 커밋·푸시·배포.

- 2026-11-24 Claude: 공고 분류·판별 Jev 재설계 적용. 직무 분야·세분화 축을 Jev choice로 태깅(영구 캐시), 직무 판별 Jev 우선·키워드 폴백, 추가 질문은 태그로 나눌 수 있으면 LLM 호출 생략. 로컬 풀 7,915건 213초 태깅. test 249·build 통과. 커밋 안 함.

- 2026-11-24 15:25 Claude: 앱 판별 분기 전수 목록과 Jev 적용 범위 `docs/설계/AI_트래픽_대응/Jev_적용범위_분기목록.md`(LLM 호출 10개·규칙 분기 26개, 적용/유지 판정·근거·위험, 우선순위). 코드 미수정. Codex 교차 검토(`.ai-sync/tasks/20261124T061233-codex/result.md`) 반영: 누락 분기 7곳 추가, 절감·비용 수치는 기준선 없어 산정 불가로 정정.

- 11/24 15:40 Claude: 배포본 Codex 재검증 36/60 반려(롤백 권고) → 사용자 승인으로 4개 수정: '전국' 공고 지역 차단 안 함, AI 다듬기 새 낱말 0개·빈칸 문자열 동일 검사, /api/prep IP당 분당 5회 제한, 경계 테스트. test 255 통과·tsc·lint·빌드, 로컬 429 확인. 커밋·푸시·배포.

- 2026-11-24 Claude: Jev 분류를 공고 DB 칼럼 방식으로 재설계. tags 칼럼별(값/""/"?"), 풀 저장 직전에만 빠진 칼럼 분류·이전 칼럼 이월, AI 새 질문은 칼럼 등록(facets.ts) 후 다음 수집에 그 칼럼만 분류, refine-question 칼럼 우선. Codex 리뷰 43점 반려 사항 4건 반영. test 256·build 통과.

- 11/24 17:50 Claude: 사용자 결정으로 신청 준비 '작성 초안'·AI 다듬기 기능 폐기 → 정보 제공 전용. 삭제: `web/app/api/prep/`, `web/lib/prep/draft.ts`, profile 사실 문장·kind shortTitle/isSourceName, 페이지 초안 섹션·AI 버튼. test 242 통과·tsc·lint·.next-prod 빌드(오래된 .next*/types 정리), 로컬 3950 확인. 미커밋·미배포(사용자 확인 대기).

- 2026-11-24 19:20 Claude: AI 체인 구조 검토 `docs/설계/AI_트래픽_대응/공고지식DB_RAG_구조화_검토.md`(공고 지식 DB+Jev+원문 청크 RAG 안, 부족한 점 P1~P7, 시나리오 S1~S5). 코드 미수정. Codex 교차 검토(`.ai-sync/tasks/20261124T101555-codex/result.md`): 전면 전환 반려·최소 수정 4개만 조건부 추천(기준선, 본문 해시 재분류, 재시도 불가 오류 폴백 중단, 일반 질문 근거 대표 표본). 반영 완료.

- 11/24 19:15 Claude: 신청 준비 '한눈에' 항목명 내용·날짜·장소·신청방법, 내용은 목적(지원·채용 등) 포함 문장(contentLine), 대상 경고 배너 최하단 이동. 초안 기능 폐기분과 함께 커밋·푸시·배포.
