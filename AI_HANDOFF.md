# AI 공동 작업 상태

이 파일은 Claude와 Codex가 함께 읽는 **현재 상태판**이다. 상세 이력은 `WORKLOG.md`에 기록한다.

## 협업 규칙

1. 작업 시작 시 이 파일과 상대 에이전트의 최근 변경을 확인한다.
2. 다른 에이전트가 만든 변경은 사용자 요청 없이 되돌리지 않는다.
3. 같은 파일을 수정할 때는 저장 직전에 최신 내용을 다시 읽고 병합한다.
4. 작업 완료·중단 시 아래 상태를 짧게 갱신하고, 중요한 작업은 `WORKLOG.md`에 추가한다.
5. 비밀값, API 키, 개인식별정보는 이 파일에 기록하지 않는다.

## 현재 상태

- 00:25 디자인 개편 My News/나만의 소식통 적용(로고·스플래시·토큰), 검증 전부 통과. 빌드는 `NEXT_DIST_DIR=.next-prod npm run build`, e2e도 같은 env로 실행(3950 dev 서버와 충돌 회피). 다음: Codex 디자인 냉정 채점 반영
- 마지막 갱신: 2026-11-22 / Codex 서비스 예시 데이터 제거
- 단계: 개발 (병렬 스레드 3개 + 통합)
- 확정 방향: **"마이뉴스"(2026-11-22 개명, 구 "찾아줄게")** — 예/아니오/모름 스무고개로 주거·지원금·채용·알바·국비과정·자격증 기회를 맞히고 새 공고 알림(PWA). 계획 `.claude/plans/youth-akinator.plan.md`, 병렬 계약 `web/CONTRACT.md`, API 키 기록 `config/api_keys.csv`(gitignore)
- 최근 산출물: `research/청년고민_4대분야.md` (주거·교통·구직·알바 GPT 딥리서치 + 해결방안 판정으로 교체)
- Git 커밋·푸시: 사용자 요청 전까지 금지

## 진행 중 / 다음 작업

- 11/25 03:15 Claude: 두 스레드(Jev 칼럼 DB / AI 질문 생성 전용·파싱 대체) 통합 커밋·배포. 후속 권고: pool 락 해제 Lua compare-and-delete, 새 칼럼 전체 분류 속도(실행당 400건), facets 동시 등록 CAS, 원문 채워진 뒤 Jev 관찰 측정·바로 신청 변화 측정.
- 11/24 20:45 Claude: 대화형 AI는 질문 생성 전용(사용자 원칙). 부가 AI(요약·근무지·조건 해석)는 `AI_AUX=1`일 때만 새로 호출. 3950 서버는 재시작 안 함(새 빌드 반영하려면 재시작 필요). 다음 후보: 카드 요약을 문장 틀로 다듬기(출처별 20건 비교).
- 11/24 20:25 Claude: RAG 전체 적용 1차(원문 eligibility DB 저장·화면 응답 제외·근거 표본) 완료, 커밋 안 함. 남은 것: 새 수집으로 원문 채우기→풀 용량 실측, Jev 측정→2단계 게이트. 모두 실 API 호출이라 사용자 허락 필요. Codex 지적 `.ai-sync/tasks/20261124T111638-codex/`.
- 11/24 20:15 Claude: 근거·상태 재사용 1단계 구현 완료(캐시 키·근거 대조·Jev 관찰 모드, test 257·빌드 통과, 커밋 안 함). 다음: `cd web; AI_EVAL=1 npx vitest run scripts/jev-target-observe.test.ts`(실 API, 사용자 허락 필요) → `plan/jev_target_observe.json` 보고 → 2단계(Jev로 LLM 생략) 별도 승인.
- 11/24 19:55 Claude: kepigame 나이 맞히기 분석 `docs/분석_kepigame_나이맞히기.md`(코드 미수정, Codex 66 조건부 반영). 정답셋 30~50건 측정은 사용자 결정으로 보류: Jev·RAG 작업 완료 → 공고 전체 분야 분류 후 분야별로 표본 뽑아 진행(원문 판독 정답 vs 추출 조건·엔진 판정). 풀은 `web/.cache/pool-v1.json` `sources.<출처>[]`(7,923건).
- 11/24 19:45 알림 설정 "내 조건" 요약 제거·버튼 "내 조건 수정"(`web/app/settings/page.tsx`). build·test 통과, 3950 반영은 재빌드 필요, 배포는 사용자 확인 대기.

- 11/24 19:15 Claude: 신청 준비 '한눈에' 항목명 내용·날짜·장소·신청방법, 내용은 목적(지원·채용 등) 포함 문장(contentLine), 대상 경고 배너 최하단 이동. 초안 기능 폐기분과 함께 커밋·푸시·배포.
- 11/24 19:20 Claude: RAG 구조화 검토 `docs/설계/AI_트래픽_대응/공고지식DB_RAG_구조화_검토.md`(코드 미수정). 전면 전환은 해커톤 이후. 다음(승인 시): carryTags 본문 해시 재분류(분류 스레드 파일), providers 재시도 불가 오류 폴백 중단, play next-question 근거 대표 표본.
- 11/24 19:20 Claude: 로고 시안 6종 `docs/설계/로고_시안/비교.png`(Codex 제작). 사용자 선택 대기 → 고르면 `web/public/icon.svg`·`icon-192/512.png`·`components/brand/Logo.tsx`·Splash 적용.
- 11/24 17:50 Claude: 사용자 결정으로 신청 준비 '작성 초안'·AI 다듬기 기능 폐기 → 정보 제공 전용. 삭제: `web/app/api/prep/`, `web/lib/prep/draft.ts`, profile 사실 문장·kind shortTitle/isSourceName, 페이지 초안 섹션·AI 버튼. test 242 통과·tsc·lint·.next-prod 빌드(오래된 .next*/types 정리), 로컬 3950 확인. 미커밋·미배포(사용자 확인 대기).
- 11/24 Claude: 분류를 공고 DB 칼럼 방식으로 재설계(사용자 요청). 수집 저장 때만 빠진 칼럼 분류, 새 AI 질문 → `lib/server/facets.ts` 칼럼 등록 → 다음 수집 때 그 칼럼만. refine-question은 칼럼 우선. test 256·build 통과, 3950 재시작. 상세 Jev 문서 9장. 미해결: 풀 저장 원자성(Codex ④). 커밋 안 함.

- 11/24 15:40 Claude: 배포본 Codex 재검증 36/60 반려(롤백 권고) → 사용자 승인으로 4개 수정: '전국' 공고 지역 차단 안 함, AI 다듬기 새 낱말 0개·빈칸 문자열 동일 검사, /api/prep IP당 분당 5회 제한, 경계 테스트. test 255 통과·tsc·lint·빌드, 로컬 429 확인. 커밋·푸시·배포.
- 11/24 15:25 Claude: Jev 적용 범위 분석 `docs/설계/AI_트래픽_대응/Jev_적용범위_분기목록.md`(코드 미수정, Codex 검토 반영). 다음(승인 시, 분류 DB 스레드 완료 후): usage 기준선 측정 → next-question 태그 기반 → jevState에 자격요건 추가 후 대상 noul.
- 11/24 Claude: 공고 분류를 Jev 판단 모델 중심으로 재설계·적용(사용자 요청). `lib/sources/classify.ts`(신규), `lib/ai/jev.ts`, `lib/sources/index.ts`, `lib/server/pool.ts`, `lib/ai/refinement-rules.ts`, `app/play/page.tsx`, `lib/types.ts`(Opportunity.tags). 로컬 풀 7,915건 태깅 완료. test 249·build 통과, 3950 재시작(.next-prod). 상세 `docs/설계/AI_트래픽_대응/Jev_판단모델_토큰절감.md` 8장. 커밋·배포 안 함. 다음: next-question도 태그 기반으로, Codex 교차 리뷰 반영.

- 11/24 15:20 Claude: 신청 준비 개편 Codex 교차 평가 32/60 '수정 후 배포'(`.ai-sync/tasks/20261124T055254-codex/result.md`) → 확인 필요는 check(AI 버튼 없음), warn·block 복사에서 초안 제외, AI는 동의 버튼 뒤(위치 미전송), 지역 불일치(별칭 포함)·요약 대상 키워드·마감 경과 판정, AI 팁 제거, AI 초안은 문장 추가·길이·새 낱말 검사. 재검증(`.ai-sync/tasks/` 최신) 지적 반영. test 243 통과·tsc·lint·빌드 통과. 커밋·푸시·배포.
- 11/24 15:00 Claude(Codex 재현 초안 `.ai-sync/tasks/20261124T055210-codex/result.md` 검토 후 일부 적용): 채용 결과 정책 공고 혼입·근거 없는 지역 핀 수정. 온통청년 일자리·취업·창업 분류 job→benefit(`youthcenter.ts`), 채용·알바는 시·도 중심 좌표 fallback 없음·잡알리오 기관명 단독(본사) 재검색 제거(`geo/geocode.ts`), 채용 주소 추출은 '근무지' 문장만·근거 없으면 AI도 호출 안 함(`geo/extract.ts`, place-v3), 채용 지역 추론에서 기관명 제외·저장 풀의 채용 region 좌표 제거(`sources/index.ts` dropRecruitRegionPin). 반려: 근무지 place 없는 채용의 원문 region 전부 삭제(원문 근무지역 필드까지 지워 지역 필터 회귀), isOpenRecruit 키워드 삭제(정책 분리 효과 없음), 사람인 place 추가(요청 밖). test 241·tsc·lint·.next-prod 빌드 통과. 커밋·푸시 안 함, 3950 서버 재시작 안 함.
- 11/24 Jev 판단 모델 토큰 절감 설계 `docs/설계/AI_트래픽_대응/Jev_판단모델_토큰절감.md`(한국어 3건 실측, 코드 미수정). 다음(승인 시): jev.ts choice 지원 → 수집 때 공고 태깅 → 질문 턴 LLM 제거.

- 11/24 무료 AI 토큰 확보 조사 `docs/설계/AI_트래픽_대응/무료AI_토큰확보_조사.md`(Codex 조사+Claude 검토·MCP 보강, 코드 수정 없음). 다음(사용자 승인 시): GLM-4.7-Flash 체인 추가, OpenRouter $10 충전 검토, 폐기 모델 TTL·Retry-After.

- 11/24 02:25 Claude: 신청 준비 설계 로컬 적용(사용자 요청). 새 `web/lib/prep/{profile,kind,draft}.ts`, `lib/prep/index.ts`·`prep.test.ts`(15), `app/prepare/page.tsx`(대상 배너·비교 표·한눈에·출처 배지 체크리스트·날짜 순서·유형별 초안·warn이면 초안 보류), `app/api/prep/route.ts`(사실 문장만 전송, 공용 프롬프트+다른 분야 예시 1쌍, checkDraft 통과분만 교체). 전체 test 229 통과·tsc·lint·.next-prod 빌드 통과, 3950 서버(next start, NEXT_DIST_DIR=.next-prod) 재시작. 화면 캡처 `docs/설계/신청준비_목업/적용_01·02.png`. 커밋·푸시 안 함. Codex 교차 평가는 대기열 `20261123T111457-codex-fsm3.json`(11/24 20:15 리셋 후).
- 11/24 피드백 설문·/privacy·Vercel Analytics 배포 완료(a82da2d). 사용자 할 일: Vercel 대시보드 Analytics 켜기. 응답 조회: GET /api/feedback (Bearer CRON_SECRET), CSV는 ?format=csv.

- 11/24 피드백 수집 방식 조사 완료 `docs/피드백_수집_배포방식.md`. 다음(사용자 승인 시): Vercel Analytics 설치, Tally 폼 제작 후 결과 화면 버튼·처리방침 푸터 추가.

- 11/23 18:40 Claude: 신청 준비(/prepare) 페이지 설계만 작성(코드 미수정, 사용자 지시). `docs/설계/신청준비_페이지_설계.md`(섹션 순서·데이터 출처·유형 판별·유형별 체크리스트/순서/초안·답→문장 변환·대상 경고·제목 정리), `docs/설계/신청준비_초안예시_프롬프트.md`(유형별 예시 문장·나쁜 예·무료 AI 공용 프롬프트·checkDraft), 목업 `docs/설계/신청준비_목업/00~03.png`(mockup.html). Codex 교차 평가는 한도로 대기열(`.ai-sync/queue/20261123T092807-codex-3bjz.json`, 20:15 리셋 후 재개) → 결과 나오면 반영.
- 11/23 15:50 Claude: 제출 배포 완료(GitHub 63f0738, Vercel success, 배포 사이트 결과 표시 확인). 다음: 서울 답인데 지도 전남 핀, 결과 과다, 채용 근무지 지도·같은 회사 묶기. 로컬 서버는 3950만(카카오 등록 포트).
- 11/23 Codex 최신: 사용자 스크린샷의 분석 화면 '조건 수정 제안' 카드만 AnalysisView.tsx에서 제거. 다른 조건 수정 기능·지역 정책·서버 유지, tsc --noEmit 통과. 추가 수정 최소화 요청 계속 준수.
- 11/23 15:20 최우선 사용자 지시: 현재 로컬 구현이 만족스러우므로 추가 수정 최대한 금지, 현재 상태 보존. Codex가 Claude b9feb5f(3문항 뒤10건 이하 종료/0건 직전복구)와 미커밋 saveLastResult 중복저장 축소를 확인. 최신 파일 단위196통과/1skip·.next-prod 빌드 통과. 전체 E2E14통과는 Claude 보고이며 이번에는 재실행하지 않음. 3950은 기존 next dev(PID10744, parent39896) 동작 중, 종료·재시작 안 함. 지역 전체표시 요청과 Claude 타지역 제외의 충돌은 변경하지 않고 보류. 기존 사용자/Claude 미커밋 변경 보존, 새 커밋/푸시/배포 없음. 별도 e2e/refinement-live.mjs는 저장 형식 변경 전 작성한 미완료 진단이므로 최신 완료 근거로 사용 금지.
- 11/23 11:13 소개서 PPTX 초안 `docs/intro/MyNews_프로젝트소개서.pptx`(13쪽, 생성 `scripts/build_intro_pptx.js`, 렌더 `docs/intro/render/pptx/`). Codex 교차 채점은 한도로 대기열(`.ai-sync/queue/20261123T021229-codex-q0c1.json`, 15:12 리셋 후 재개). 결과 나오면 쪽별 수정 반영 후 재생성. 팀명 미정(임시 김유강).
- 11/23 10:30 최신(Codex): 추가 질문을 고정 facet 선택과 분리한 /api/refine-question 구현. 남은 원문 제목·요약(분야별 최대240건 표본)+이전 답변으로 AI가 새 질문/선택지/원문 구절을 생성, 근거·실제 후보 감소 검증 후 topic 선호 필터 부착. 모름·미분류 공고 보존. 기존 UI 유지, 초기 탐색 뒤 및 결과에서 추가 질문 시 사용. 실패를 질문 소진으로 표시하지 않고 재시도 제공. 되돌리기 시 고정 질문 자동 skip이 개입하던 오류 수정. 기본 Groq 모델 폐기(404) 확인→동일 제공자 목록과 실호출 검증된 openai/gpt-oss-120b + low reasoning 적용. OpenRouter 무료 모델 종료404/CF 모델 폐기410/Gemini 한도429는 여전히 보조 경로 제약. :3950 신규 API 실제 생성 성공(가상 공고), 단위180pass/1skip·프로덕션 .next-prod 빌드 성공, e2e/refinement-flow.mjs 브라우저 생성→선택→후보감소→이력→undo→모름→재시도 통과(생성 응답 모킹). 전체 기존 E2E 재실행은 아직. 4스레드 보류/배포·커밋·푸시 없음.
- 11/23 잔여 검수(Codex): 정중한 ~습니다 UI/AI 문체와 저장 질문 정규화, ConditionEditor 나이·소득 슬라이더/±5세·배치 적용 구현은 로컬 반영. 이전 문체 일괄 치환의 부자연스러운 문자열/주석 추가 정리 및 편집 UI 전체 E2E 필요(교육 숫자 임계 select 처리도 점검). 채용 상세 근무지 지도 반영·셀트리온 회사별 카드 묶음·분석8항목 나머지는 아직 미구현/미완료. 셀트리온 공식 recruiter 상세의 근무지 확인: api-recruiter.recruiter.co.kr/position/v2/jobflex/134214, 공개 tenant prefix 헤더 celltrionph.recruiter.co.kr, jobDescription HTML 표에 충북 청주시/경기도 과천시. 본사 주소를 확정 근무지로 쓰지 말 것. 지도/중복 완료로 보고하지 말 것. 이번 변경 핵심: play/page, api/refine-question, lib/ai/refinement, providers, engine topic/answer-groups, ConditionEditor, copy 및 관련 테스트. Impeccable detector 2건은 기존 버튼 삼항 클래스의 비동시 색상 조합 오탐, 신규 디자인 개편 없음.
- 11/23 09:58 최신(Codex): Kakao 지도 실제 localhost:3950 SDK·타일 로딩 및 클릭→나 핀/거리 선택 확인. KAKAO_MAP_KEY를 /api/map-config에서 읽고 REST 키는 반환하지 않음. 온통청년 사용자 신규 YOUTHCENTER_API_KEY에 어댑터 변수명 통일, 키 없던 calls=0 캐시는 키 등록 직후 첫 수집하도록 수정. 실제 공식 API 성공, 앱 /api/opportunities에 32건(혜택23/주거3/일자리6) 확인. 기존 첫50건 수집 제한 유지, 전수 수집 아님. 단위173통과/1skip·tsc 통과. 지도 변경 빌드 성공, 기존 브라우저14/14통과(외부 지도는 대체지도 모킹, 실제 Kakao는 별도 확인). 마지막 단일 핀 중심 보정·온통청년 변경 후 빌드/E2E 재실행은 아직. 변경: KakaoMap, kakao-sdk, map-config 및 test, LocationStep, ResultMap, youthcenter 및 test, pool 및 test, sources/pool-branch test, e2e/scenarios. 다음: 온통청년 페이지 전체수집·연령제한 플래그 의미/분야 매핑 정밀 검토 및 기존17항목 잔여 검수. 4개 스레드 보류, 배포/커밋/푸시 없음.
- 11/23 최신: 사용자가 답변·공고 근거의 외부 AI 전송을 명시 승인했다. 승인 대기 해제. 기존 /play UI 유지, /api/next-question에서 질문+선택지 생성 프롬프트 및 검증 연결 완료. 허용 필터 키·중복·후보 감소 검사, 개인정보 별도 필드 제외. 실제 :3950 API 호출에서 교육비/생활비 새 질문 생성 확인. 단위 169통과/1skip, .next-prod 빌드 성공, 동적 질문 브라우저 단독 테스트 통과. 17개 전체 검수 완료는 아님: 지도 E2E d 실패 원인 및 조건 수정/추가 질문 기존 회귀 후속 필요. 이전 기록의 ‘전송 승인 대기’는 해제됨. 4개 스레드 보류/배포 없음 유지.
- 11/23 Codex 사용자 검수 수정 진행 중(미완료). 최우선 요구: 기존 질문·버튼 UI 유지, 고정 분기 질문이 아닌 API 기반 동적 질문/선택지 생성. 입력은 이전 답변+남은 공고 근거, 중복/무효 질문 금지, 실제 후보 감소 검증 필요. 이번에 시도한 고정 대화 모듈은 요구 불일치로 제거했다. 개인 답변의 AI API 전송 확대 패치가 자동 승인 검토에서 차단되어 구체적 전송 범위 승인 대기. 4개 스레드 검증 보류. 분야 선택 보존·6개 페이지·지도 묶음 핀·방문 접수처 추출·분야별 분석/변경 취소·통계 조회 구현분은 로컬에 남았으나 최종 통합 검증 전. 배포/커밋/푸시 안 함.
- 11/23 소개서 두 버전 완성: `docs/intro/My News_소개서_Claude버전.pdf`, `docs/intro/My News_소개서_Codex버전.pdf`(원본 html 같은 폴더, 렌더 `e2e/render-intro.mjs`). 사용자 선택 대기. 제출 전 팀 정보·사전 개발·출품 이력 입력 필요. 파일명 `[팀명]_My News_AI 해커톤_20261123.pdf`.

> 어느 에이전트든 한도로 멈췄다가 재개하면 이 목록 위에서부터 이어서 한다.

1. [사용자 대기] GitHub 푸시 완료(claude/project-thread-pm1ii1, 9b0f8d5) → Vercel Import(Root=web) 대기. data.go.kr 키를 `config/api_keys.csv`에 기록, Vercel 가입·배포 방식(A: GitHub 업로드 허락 / B: `npx vercel login`), Upstash 연결. 안내 `docs/사용자_할일.md`
2. [키 도착 후] `web/.env.local` 작성(VAPID·CRON_SECRET 생성 포함) → 실데이터로 게임→결과→저장→재조사 확인 → 배포 → 앱 닫은 상태 푸시 확인
3. [배포 후] 실데이터 3분야(주거·채용·정책) 중심으로 시연 정리(`docs/demo_script.md`)
4. [제출 전] 소개서 PDF `output/pdf/찾아줄게_프로젝트소개서_20261122.pdf`의 빨간 입력 필요 항목(팀명·대표자·팀원·역할, 기존 개발물·타 공모전 사실 확인, 공개 URL)을 채우고 배포·Cron·앱 종료 푸시 증거 반영 → 최종 파일명 변경(마감 11/23 17:00)
5. 대기열: `.ai-sync/queue/*.json`이 있으면 `node .ai-sync/resume.mjs`로 재개(리셋 시각 지난 것만 실행)

## 최근 변경 파일

- 2026-11-23 Codex 내용 재검토: 현재 표기는 My News / 나만의 소식통. 기존 보고서·PDF는 개명 외에도 선택형 질문, AI 후보 질문 선택, 지도·반경, 요약·신청 안내, 다중 AI 제공자 폴백 반영 필요. 11/22 운영 데이터·Upstash·수동 재조사 검증 기록이 있으므로 배포 전 상태 설명은 구버전. 운영 최신 반영·정기 Cron·앱 종료 푸시는 별도 확인 필요. 이번 작업은 코드/기록 읽기 기반 검토이며 앱·제출물 수정 및 테스트 재실행 없음.

- 2026-11-22 저녁 Claude: 서비스명 "마이뉴스"로 변경(앱 제목·홈·manifest·푸시·아이콘·문서). 지도(위치·반경·핀↔리스트), 카드 요약·신청 방법·신청 페이지 버튼, 주소 추출(규칙+Gemini)·캐시, Gemini 429 시 10분 호출 중지. 카카오 키 대기(KAKAO_REST_API_KEY). 커밋함, 푸시 안 함.

- 2026-11-22 Claude 배포 피드백 6건 수정(공고 991건·알바 분류·조건 8종·선택형 질문·Gemini 다음 질문·분석 탈락 공고 목록·지역 근무 필터). 커밋함, 푸시 안 함 → 배포 반영하려면 사용자 요청 후 푸시. 검수 `cd e2e && node audit-live.mjs http://localhost:5300`, e2e `LIVE_API=1 npm test`.

- 2026-11-22 13:10 Claude 사용성 검수: `docs/검수_절차.md`, `docs/검수_결과_20261122.md`, `e2e/audit-live.mjs`(배포 사이트 자동 검수, `cd e2e && node audit-live.mjs`). 기준선 5/17, Codex 앱 34 반려·절차 64 조건부. 배포가 바뀔 때마다 다시 돌린다. 고칠 목록은 결과 문서 5절

- 11:30 배포 실검증 완료: 실데이터 191건, 알림 저장(Upstash)·서버 재조사 동작. 남은 것: 사용자 크롬에서 알림 허용 후 푸시 도착 확인, 보고서 팀 정보·캡처

- 2026-11-22 Claude 시나리오 보강: 소득 구간 선택, 감시 분야=고른 분야, 받은 알림 유지, 완화 안내 분리, 테스트 전용 공고 파일 경로(E2E_LOCAL=1, 배포 무시). e2e `cd e2e && LIVE_API=1 npm test`(web 빌드 후, 10/10). Codex 4차 a74·b69·c66 반려(차별성). 커밋 안 함.

- 2026-11-22 Claude 사용자 흐름 점검: 지역 한 번에 선택·고른 분야 재질문 제거·홈 분야별 건수·청년 비대상 제외·결과 화면 완화안/조건 고치기·지역 근무 정렬. 변경: web/app/{page,play/page,result/page,result/analysis/page}.tsx, web/components/result/{RelaxSuggestions,ConditionEditor,sort}.tsx|ts, lastResult.ts, web/lib/insight/{funnel,types}.ts, web/lib/sources/index.ts, 새 `e2e/`(시나리오 3개, `cd e2e && npm install && npm test`, 서버 :5300 필요). Codex 2차 a67·b56·c55 반려 유지. 다음: 알림 재조사 e2e, 소득 질문 반복 줄이기. 상세 `docs/사용자흐름_점검.md`

- 09:05 푸시(a7fe940)·Vercel 배포 성공, 운영 https://kdtaihackathon-web.vercel.app. 공고 0건 → 사용자가 Vercel 환경변수(docs/배포_환경변수.md) 입력 후 Redeploy 필요. 그다음 실데이터·알림 저장·푸시 실검증

- 서비스 예시 데이터 제거: sources/index.ts 샘플 대체 제거, play 빈 결과·오류 화면, lastResult의 demo 파라미터 제거·기존 세션 샘플 제외, sampleResult.ts 삭제. 홈 예시 안내 제거. alerts 가상 공고 생성 제거, 실제 새 공고 확인으로 전환·과거 가상 알림 숨김. 테스트용 JSON·fixture는 보존하며 런타임 참조 없음. 회귀 테스트 97개 통과·1개 제외. 소개서는 양식 제목을 주제목으로 복원, 요약 문제/해결/구현·기술 스택 보강, 제목 명사형·설명 문어체 반영; 최종 시각 확인은 후속 필요. 운영 배포·Cron·푸시 검증은 여전히 대기.

- 최신 소개서: `scripts/build_intro_designed.py`로 재생성한다(이전 build/refine 스크립트는 구판). 16:9, Noto Sans KR 임베딩, 제목 30pt·본문 중심 16~24pt, 네이비/청록, 평면 배치. `output/pdf/찾아줄게_프로젝트소개서_20261122.pdf`는 표지 1+본문 10+지정 별첨 4=15쪽. 별도 API/질문 필터 PDF와 PNG도 갱신. 15쪽 렌더 시각 확인·문자 경계 검사 통과. 공공 API 6종 원문 이용조건 및 Noto OFL 출처 추가, Anthropic SDK Apache-2.0 표기, 민간조사 50.5% 의미 정정. 웹 조사 Tavily 한도(432)로 Exa 사용. 팀 정보·공개 URL·사전 개발/출품 이력은 확인 대기. 앱 코드는 변경하지 않음.

- 2026-11-22 Codex 재개: 승인된 셸로 렌더 이미지를 읽어 시각 검수 성공. API 각주 겹침 수정, 공식 API→규칙/Gemini와 Tavily→Exa→Jev 검색 보충 경로 분리, 질문별 가상 공고 예시 1쪽 추가. 소개서 총 12쪽(본문 10쪽), 별도 `찾아줄게_API와_질문필터_흐름도.pdf`, `찾아줄게_흐름도-1.png`, `찾아줄게_흐름도-2.png`. 웹검색 결과는 조건 배열이 비어 있어 자격 적합성을 보장하지 않는 실제 한계 명시. 재생성: `scripts/refine_project_intro.py`. 제출 전 팀 정보·공개 URL·사전 개발 이력·상세 이용조건 확인 필요.

- 01:36 Codex 소개서 PDF 완성: 양식·대회 안내·AI 출처 기준을 반영한 11쪽(표지+본문 9+별첨), 통계 그래프·Happy Path·인프라와 API→공통 모델→조건 구조화→질문별 예/아니오/모름 필터→Cron/Web Push 흐름도 포함. `scripts/build_project_intro.py`, `output/pdf/찾아줄게_프로젝트소개서_20261122.pdf`. 재검증 test 95(+1 skip)·lint·build 통과. PDF 11쪽 렌더/문자 경계 검사 통과. 남음: 팀 정보·공개 URL·실환경 Cron/푸시.

- 02:10 AI 정확도 Codex 채점 반영: 앱 방식(규칙 우선+AI 보완) 정밀도 94.6%·재현율 92.1%, 보고서 07절 표. 다음: 배포(사용자 허락 후)·배포 후 실검증·보고서 남은 빈칸(팀 정보·배포 링크·캡처)

- 01:50 Jev 실동작, 첫 로딩 3초(AI 백그라운드), 홈 예시 분야 표시, `docs/배포_환경변수.md`. AI 정확도 Codex 채점 대기(`plan/ai_eval_data.json`). 데모 http://localhost:5100

- 01:15 Gemini 실동작(AI 해석 17건), AI 조건 안전장치·동시 2건 제한. 첫 로딩 ~24초(시연 전 한 번 미리 열어 캐시 데우기). 청약홈 일시 0건. CSV 14행 삭제. 데모 http://localhost:4900

- 00:45 CSV 정리(키 있는 행+예정 행만, 백업 config/api_keys.20261121.backup.csv), store.ts KV_REST_API_* 폴백, 청약홈 실데이터 34건 동작. 데모 http://localhost:4700

- 00:30 Gemini(무료 등급, Claude 키 없을 때 대체)·Jev(웹 검색 공고 판별, 선택) 연결. 키 미입력이라 실호출 미검증. CSV GEMINI_API_KEY·JEV_API_KEY 행 추가 대기(엑셀 잠금). test 93·build·lint 통과

- 00:10 웹 검색 보충 켬(WEB_SEARCH_ENABLED=1): Tavily는 계정 한도 초과(432)로 실패 → Exa 자동 전환 추가, 목록·메뉴 페이지 제외 필터. 실제 공고형 결과 2건만 남음(보충 효과 작음). test 89·build·lint 통과. 데모 http://localhost:4600

- 23:55 실데이터 연결 완료: data.go.kr 5개 실호출 OK(청약홈만 활용신청 대기 401), `.env.local`에 DATA_GO_KR_KEY·VAPID·CRON_SECRET. 같은 출처 공고 중복 제거 오류 수정(`lib/sources/dedupe.ts`). 앱 174건 중 실데이터 156. 데모 http://localhost:4400. 다음: Upstash 연결 + Vercel 환경변수 입력 → 배포 확인

- 23:35 청약홈 어댑터 `lib/sources/applyhome.ts`, 사람인 어댑터 `lib/sources/saramin.ts`(기본 OFF), 키는 `config/api_keys.csv`(UTF-8 BOM, 엑셀로 입력)에서 점검 스크립트가 읽음. test 86·build·lint 통과. 데모 http://localhost:4000. 다음: 키 입력되면 `cd web; node scripts/check-sources.mjs --env` → 실데이터 화면 확인

- 23:20 Next.js 15.5.29 보안 패치(Vercel 차단 대응, test 81·build·lint 통과), 실데이터 점검 스크립트 `web/scripts/check-sources.mjs`(키 입력 후 `node scripts/check-sources.mjs --env`). CSV 키 칸 아직 비어 있음. 데모 http://localhost:3900

- 23:15 민간 API 조사 `docs/민간API_조사.md`: 청약홈 분양정보(자동승인) 채택 추천, 사람인은 지금 신청·기본 OFF. 잡코리아·알바·원티드·직방/다방 제외

- 22:50 취업 상태 오탈락 수정(사용자 요청): `lib/engine/index.ts` `lenient()` — 취업 상태·우대/우선/예외 문구·불확실 해석·기준중위소득 아닌 소득 기준은 맞지 않아도 탈락 대신 "확인 필요". 하드 유지: 나이·지역·무주택·1인 가구·기준중위소득·관심 없음. test 81·build·lint 통과. 데모 http://localhost:3800 (3700 종료). 다음: data.go.kr 활용신청 후 키를 `config/api_keys.csv`에 넣으면 실데이터 테스트

- 22:40 결과 흐름 UX 개편(사용자 요청): 홈 관심 분야 선택(`/play?domains=`), 결과는 공고 3개 먼저 + "더보기"/"질문 더 해서 좁히기"(`/play?continue=1`, 지난 답 이어 3문항), 분석은 별도 페이지 `/result/analysis` + 단답형 `components/result/AnalysisView.tsx`(통과율 링·조건 칩·병목 +N·조건별 탈락·분야별), `FunnelPanel` 삭제, 결과 카드 근거 중복 제거·최대 3줄, `components/result/lastResult.ts`. test 77·build 통과. 데모 http://localhost:3700, 캡처 screenshots/6~8

- 14:55 대회 양식 기준 보고서 초안 `docs/제출_보고서_초안.md`(표지·요약·01~08·별첨 + AI 활용내역). Codex 교차 평가 65/100 반려(`.ai-sync/tasks/20261121T053920-codex/result.md`): 배포·실데이터·AI 정확도 증거 부재. 사실과 다른 문장(개인정보 미수집 단정, 보안 8건 중 7건, 테스트 수치 시점, 중복 제거 정확도) 수정 반영

- 13:35 데모 확인용: 로컬 서버 http://localhost:3400(최신 빌드), 화면 캡처 `docs/screenshots/1~5`, 안내 `docs/데모_확인방법.md`. 엔진 판정 수정: 관심 분야 조건은 soft(묻지 않아도 확인 필요 아님), 나이 하한 19 기본 지식, 취업상태 값 도메인 추론(직장인·알바 아니오 → 구직·학생 통과) → 바로 신청 0→22개. `lib/engine/youth.test.ts` 추가, test 76·build 통과. 남은 포트 3100·3200·3300 서버는 종료 실패(자동 모드), 사용자 정리 필요

- 12:50 마감일 변경·D-3 서버 감지(`lib/server/changes.ts`, WatchRecord.known, 공고당 D-3 1회, 푸시 한 건으로 묶음), 출처 간 중복 공고 제거(`lib/sources/dedupe.ts`, 공식 API 우선), 주간 리포트에 변경·임박 수. test 74·build·lint 통과. 스케줄러 자동 재개 실동작 확인(10:44), GitHub 푸시 확인

- 11:10 SH 공식 RSS 어댑터 `web/lib/sources/sh-rss.ts`(+테스트 4): 기본 OFF(`SH_RSS_ENABLED=1`), 공식 피드(EUC-KR)에서 모집 공고만, 제목·링크·게시일만, `origin="rss"` + "SH 공식 RSS · 원문 확인" 배지, 실패 시 빈 배열. CSV 25행. test 70·build 통과. 미반영 목록 `docs/미반영_목록.md`

- 11:00 사용자 할 일 통합 문서 `docs/사용자_할일.md`(15항목), 작업 스케줄러 1회 등록 스크립트 `.ai-sync/register-resume-task.ps1`(30분 주기, delegate는 더 이상 PC 설정 변경 안 함), `.gitignore` 보강(키·대화 기록·venv·대회 PDF 제외), 소개서·AI 활용내역 초안

- 10:58 한도 대응: `.ai-sync/delegate.mjs` — 대상이 한도면 다른 에이전트로 폴백(교차 평가 `--review`는 폴백 안 함), 둘 다 한도면 `.ai-sync/queue/`에 저장 후 종료 코드 75 + 리셋 시각 +3분 작업 스케줄러 예약. `.ai-sync/resume.mjs` — 대기열 재실행. 테스트: 폴백·대기열·review 비폴백·재실행 통과. 작업 스케줄러 등록은 사용자 권한 필요(자동 모드에서 차단)

- 10:25 ECC verification-loop: build PASS, tsc PASS(0), lint PASS(경고 3건 수정 후 0), test 66/66 PASS, 비밀값 스캔 이상 없음, console.log 없음. 배포 검증은 미실시(Vercel·Upstash·data.go.kr 키 대기). 시연 순서 초안 `docs/demo_script.md`. SH 게시판 어댑터(기본 OFF)는 배포 후 순위로 보류

- 10:30 도구 스레드: Scrapling(`.venv-tools/`)·agent-browser·k-skill 9개(프로젝트 범위) 설치. 11:00 insane-search도 개발용 설치(프로젝트 범위, 라우터 훅 `GPTAKU_ROUTER=off`, 앱 런타임 미사용). SH 공고 기본 OFF 어댑터는 후보(통합 스레드 판단). `docs/research_tools.md`

- 10:15 사용자 요청: Tavily·Exa 웹 검색 보충을 설정 온오프로 추가(`lib/sources/websearch.ts` + 테스트). 기본 OFF, `WEB_SEARCH_ENABLED=1`+`TAVILY_API_KEY`/`EXA_API_KEY`일 때만, 기본 검색 범위는 공공기관 도메인(`WEB_SEARCH_DOMAINS`로 변경), 제목·링크·200자 요약만 저장, `Opportunity.origin="websearch"` + 결과 카드 "웹 검색 결과 · 원문 확인 필요" 배지. config/api_keys.csv 23·24행. test 66·build 통과

- 10:05 Codex 코드·보안 리뷰(`.ai-sync/tasks/20261121T004030-codex/result.md`) 반영: /api/watch 소유자 토큰(해시 저장, Bearer 검증)·서버 seenIds 병합·푸시 구독 호스트 검증·DELETE, cron은 운영에서 CRON_SECRET 없으면 503, seenIds 1000개 상한·만료 인덱스 정리, 메모리 모드 "데모 모드" 표기·저장 동의 문구·조건 지우기 시 서버 삭제(`lib/server/security.ts` + 테스트). 동시 조사 경합(CAS)은 미적용. UX 레퍼런스 반영: 홈 문구("연결된 출처를 매일 다시 조회, 처음 보는 공고만"), 6문항, 질문별 "예면 N개·아니오면 M개", 결과 분야별 통과·예시 데이터 경고, 알림함 출처별 실데이터/예시 칩. test 63·build 통과

- 09:55 시장조사·UX 스레드(문서만): `docs/market_research.md`(경쟁 13개·기능 공백·청년 수치 정부 PDF 대조·발표용 숫자와 쓰면 안 되는 표현·미대비 심사 질문 답변안), `docs/ux_reference.md`(화면별 와이어프레임, 병목일 때만 "꼭 지켜야 해요", 0건/조사 실패 구분, 마감 전 비현실 항목 분리). Codex 교차 검토 반영(`.ai-sync/tasks/20261121T004024-codex/result.md`)

- 09:45 리서치형 기능(사용자 요청): `lib/insight/`(types, funnel — Codex 초안 적용·요약 문장 Claude 수정), 결과 화면 FunnelPanel(전체 중 % 통과·조건별 탈락 막대·병목 완화 제안·"꼭 지켜야 해요"), 게임 최대 7문항+"바로 결과 보기", 조사 기록 history·주간 리포트(WeeklyReport, /alerts), vitest.config.ts(@ 별칭), 시연 흐름 통합 테스트 `lib/server/flow.test.ts`. test 61·build 통과, 브라우저로 게임→결과→저장→재조사 확인. Codex 코드·보안 리뷰 진행 중

- 09:00 Codex 재평가(핵심 가치 명시): 컨셉 74 조건부, 현재 구현 61 반려(백그라운드 반복 탐색 부재). 1순위 구현: 서버 반복 리서치 — `lib/server/store.ts`(Upstash REST, 없으면 메모리), `lib/server/scan.ts`(조건별 재조회→새 공고만 푸시→seenIds 갱신), `app/api/watch`(조건·구독 저장, ?scan=1 즉시 조사), `app/api/cron/scan`(CRON_SECRET), `vercel.json`(매일 09:00 KST), /alerts "반복 리서치 현황" 패널. 로컬 스모크 테스트 통과(1회차 21건, 2회차 0건)

- 05:55 Codex 앱 평가 54점 반려(정책 추천 서비스와 중복). 사용자에게 "실행 순서 설계"로 전환할지 결정 요청 중. 버그 3개 수정: 알림 매칭을 엔진 판정으로 통일(lib/alerts/core.ts), /api/push 남용 방지(푸시 서비스 호스트 제한·고정 문구·IP당 분당 3회), AI 해석 조건 표시(Condition.aiGenerated, 결과 카드 "AI 해석" 배지). test 50·build 통과

- 통합(05:20): globals.css 정리, PWA 아이콘 192/512 생성, layout에 AlertBell(결과 화면 중복 제거), package-lock 재동기화(npm ci 통과), 엔진에 청년 무관 나이 질문 제외·첫 질문 관심분야 가중. npm test 50개·build 통과, 로컬에서 게임→결과 끝까지 확인. Codex 앱 교차 평가 05:37 자동 실행 예약

- T2 완료(04:50): `web/lib/sources/**`(어댑터 7개+샘플 폴백), `web/data/samples/*.json`(58건), `web/lib/ai/**`(Claude/규칙 폴백), `web/app/api/opportunities/route.ts`. 테스트 32개·build 통과. 새 env `WORK24_TRAINING_KEY`(훈련과정). Codex 교차 평가 미실시

- T1 완료(04:20): `web/lib/engine/**`(엔진·테스트·픽스처), `web/app/play/**`(게임 화면, `/play/phrase` AI 문장), `web/components/game/**`. npm test·build 통과
- `web/` Next.js 15 앱 뼈대, `web/lib/types.ts`(공통 타입, 통합 스레드 소유), `web/CONTRACT.md`(담당 경로: T1 엔진·게임 / T2 데이터·AI / T3 결과·알림)
- `config/api_keys.csv`: 발급 가능 API 20개, 키 칸 비움

- `.ai-sync/prompts/strict-review.md`, `delegate.mjs --review`: 교차 평가(만든 쪽이 채점 금지, 상대가 냉정 채점). 규칙은 CLAUDE.md·AGENTS.md

- `.ai-sync/delegate.mjs`: 상대 에이전트에 작업 위임(`node .ai-sync/delegate.mjs codex "요청"`, 기본 읽기 전용), 결과는 `.ai-sync/tasks/`

- `AGENTS.md`: Codex용 공동 작업 규칙 추가
- `CLAUDE.md`: Claude가 공동 상태판을 읽고 갱신하도록 규칙 추가
- `AI_HANDOFF.md`: Claude–Codex 공동 상태판 생성

## 에이전트 메모

- Claude: 다음 작업을 시작할 때 이 파일을 읽고 현재 상태를 확인한다.
- Codex: 다음 작업을 시작할 때 Claude의 최신 변경과 `WORKLOG.md`를 함께 확인한다.

