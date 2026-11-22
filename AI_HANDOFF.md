# AI 공동 작업 상태

이 파일은 Claude와 Codex가 함께 읽는 **현재 상태판**이다. 상세 이력은 `WORKLOG.md`에 기록한다.

## 협업 규칙

1. 작업 시작 시 이 파일과 상대 에이전트의 최근 변경을 확인한다.
2. 다른 에이전트가 만든 변경은 사용자 요청 없이 되돌리지 않는다.
3. 같은 파일을 수정할 때는 저장 직전에 최신 내용을 다시 읽고 병합한다.
4. 작업 완료·중단 시 아래 상태를 짧게 갱신하고, 중요한 작업은 `WORKLOG.md`에 추가한다.
5. 비밀값, API 키, 개인식별정보는 이 파일에 기록하지 않는다.

## 현재 상태

- 마지막 갱신: 2026-11-22 / Codex 서비스 예시 데이터 제거
- 단계: 개발 (병렬 스레드 3개 + 통합)
- 확정 방향: **"마이뉴스"(2026-11-22 개명, 구 "찾아줄게")** — 예/아니오/모름 스무고개로 주거·지원금·채용·알바·국비과정·자격증 기회를 맞히고 새 공고 알림(PWA). 계획 `.claude/plans/youth-akinator.plan.md`, 병렬 계약 `web/CONTRACT.md`, API 키 기록 `config/api_keys.csv`(gitignore)
- 최근 산출물: `research/청년고민_4대분야.md` (주거·교통·구직·알바 GPT 딥리서치 + 해결방안 판정으로 교체)
- Git 커밋·푸시: 사용자 요청 전까지 금지

## 진행 중 / 다음 작업

> 어느 에이전트든 한도로 멈췄다가 재개하면 이 목록 위에서부터 이어서 한다.

1. [사용자 대기] GitHub 푸시 완료(claude/project-thread-pm1ii1, 9b0f8d5) → Vercel Import(Root=web) 대기. data.go.kr 키를 `config/api_keys.csv`에 기록, Vercel 가입·배포 방식(A: GitHub 업로드 허락 / B: `npx vercel login`), Upstash 연결. 안내 `docs/사용자_할일.md`
2. [키 도착 후] `web/.env.local` 작성(VAPID·CRON_SECRET 생성 포함) → 실데이터로 게임→결과→저장→재조사 확인 → 배포 → 앱 닫은 상태 푸시 확인
3. [배포 후] 실데이터 3분야(주거·채용·정책) 중심으로 시연 정리(`docs/demo_script.md`)
4. [제출 전] 소개서 PDF `output/pdf/찾아줄게_프로젝트소개서_20261122.pdf`의 빨간 입력 필요 항목(팀명·대표자·팀원·역할, 기존 개발물·타 공모전 사실 확인, 공개 URL)을 채우고 배포·Cron·앱 종료 푸시 증거 반영 → 최종 파일명 변경(마감 11/23 17:00)
5. 대기열: `.ai-sync/queue/*.json`이 있으면 `node .ai-sync/resume.mjs`로 재개(리셋 시각 지난 것만 실행)

## 최근 변경 파일

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

