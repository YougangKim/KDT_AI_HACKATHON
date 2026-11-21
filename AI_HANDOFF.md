# AI 공동 작업 상태

이 파일은 Claude와 Codex가 함께 읽는 **현재 상태판**이다. 상세 이력은 `WORKLOG.md`에 기록한다.

## 협업 규칙

1. 작업 시작 시 이 파일과 상대 에이전트의 최근 변경을 확인한다.
2. 다른 에이전트가 만든 변경은 사용자 요청 없이 되돌리지 않는다.
3. 같은 파일을 수정할 때는 저장 직전에 최신 내용을 다시 읽고 병합한다.
4. 작업 완료·중단 시 아래 상태를 짧게 갱신하고, 중요한 작업은 `WORKLOG.md`에 추가한다.
5. 비밀값, API 키, 개인식별정보는 이 파일에 기록하지 않는다.

## 현재 상태

- 마지막 갱신: 2026-11-21 10:58 / Claude(통합 스레드)
- 단계: 개발 (병렬 스레드 3개 + 통합)
- 확정 방향: **청년 기회 아키네이터 "찾아줄게"** — 예/아니오/모름 스무고개로 주거·지원금·채용·알바·국비과정·자격증 기회를 맞히고 새 공고 알림(PWA). 계획 `.claude/plans/youth-akinator.plan.md`, 병렬 계약 `web/CONTRACT.md`, API 키 기록 `config/api_keys.csv`(gitignore)
- 최근 산출물: `research/청년고민_4대분야.md` (주거·교통·구직·알바 GPT 딥리서치 + 해결방안 판정으로 교체)
- Git 커밋·푸시: 사용자 요청 전까지 금지

## 진행 중 / 다음 작업

> 어느 에이전트든 한도로 멈췄다가 재개하면 이 목록 위에서부터 이어서 한다.

1. [사용자 대기] data.go.kr 키를 `config/api_keys.csv`에 기록, Vercel 가입·배포 방식(A: GitHub 업로드 허락 / B: `npx vercel login`), Upstash 연결. 안내 `docs/사용자_할일.md`
2. [키 도착 후] `web/.env.local` 작성(VAPID·CRON_SECRET 생성 포함) → 실데이터로 게임→결과→저장→재조사 확인 → 배포 → 앱 닫은 상태 푸시 확인
3. [배포 후] SH 공고 게시판 어댑터(기본 OFF, 약관 사람 확인 필요), 실데이터 3분야(주거·채용·정책) 중심으로 시연 정리(`docs/demo_script.md`)
4. [제출 전] ECC verification-loop 재실행, 소개서·AI 활용내역 작성(마감 11/23 17:00)
5. 대기열: `.ai-sync/queue/*.json`이 있으면 `node .ai-sync/resume.mjs`로 재개(리셋 시각 지난 것만 실행)

## 최근 변경 파일

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
