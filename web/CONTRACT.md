# 병렬 개발 계약 (청년 기회 아키네이터)

모든 스레드는 같은 폴더(`D:\KDT_AI_HACKATHON\web`)를 쓴다. **자기 담당 경로만 수정**한다. 담당 밖 파일이 필요하면 통합 스레드에 요청한다. git 커밋·푸시는 하지 않는다.

## 공통 규약
- 공통 타입: `lib/types.ts` (통합 스레드 소유, 읽기 전용)
- `package.json` 의존성 추가는 통합 스레드만. 필요한 패키지는 보고에 적는다. 이미 설치: `@anthropic-ai/sdk`, `web-push`, `vitest`
- 키: `process.env.*` 로만 읽고, 없으면 샘플·규칙 기반으로 폴백(키 없이 전체 흐름이 돌아야 함). 이름은 `config/api_keys.csv`의 `환경변수명`
- AI 생성 문장은 화면에 "AI 생성" 표시. 실제 개인정보를 외부 AI로 보내지 않는다(답변 범주값만)
- 테스트: `lib/**/*.test.ts` (vitest), `npm test`

## 담당 경로와 공개 함수

| 스레드 | 담당 경로 | 공개 인터페이스 |
|---|---|---|
| 통합(T0) | `lib/types.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `package.json`, 배포 | 홈 → `/play` 진입 |
| 엔진·게임(T1) | `lib/engine/**`, `app/play/**`, `components/game/**` | `lib/engine/index.ts`: `startGame(pool: Opportunity[]): GameState`, `nextQuestion(s): Question \| null`, `applyAnswer(s, q, a): GameState`, `getMatches(s): Match[]`, `remaining(s): number`. 게임 종료 시 `sessionStorage["lastResult"] = JSON.stringify({answers, matches})` 후 `/result` 이동 |
| 데이터·AI(T2) | `lib/sources/**`, `data/samples/**`, `lib/ai/**`, `app/api/opportunities/**` | `lib/sources/index.ts`: `loadOpportunities(domains?: Domain[]): Promise<Opportunity[]>` / `GET /api/opportunities?domains=housing,benefit` → `Opportunity[]` / `lib/ai/index.ts`: `structureConditions(rawText): Promise<Condition[]>`, `phraseQuestion(q): Promise<string>`, `explainMatch(m): Promise<string>` (키 없으면 규칙 기반) |
| 결과·알림(T3) | `app/result/**`, `app/alerts/**`, `components/result/**`, `lib/alerts/**`, `public/sw.js`, `public/manifest.json`, `app/api/push/**` | `lib/alerts/index.ts`: `saveWatch(w: Watch)`, `loadWatch(): Watch \| null`, `findNew(w, pool): Opportunity[]` / `/result`는 `sessionStorage["lastResult"]`를 읽는다 |

## 데모 기준(11/23 17:00 마감)
키 없이 링크로: 홈 → 게임 10문항 안팎 → 결과 카드(D-day·왜 맞는지·확인 필요) → 알림 저장 → 새 공고 알림 확인
