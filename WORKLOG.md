# 작업 로그 — 대한상공회의소 AI 해커톤

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
