# Plan: 청년 기회 아키네이터 (가칭 "찾아줄게")

**Source**: 사용자 지시 (2026-11-21 03:55 KST) — 아키네이터형 게임 + 알림 앱, 분야 확장형
**Complexity**: Large (마감 2026-11-23 17:00, 개인 1명)
**확인**: 사용자가 "개발 시작"을 이미 지시함 → 계획 확정 후 바로 착수

## Summary
예/아니오/모름으로 답하는 스무고개 게임으로 청년의 상황을 좁혀 가며, 지금 받을 수 있는 주거·알바·구직·청년정책·지원금·국비과정·자격증 기회를 "맞혀" 주고, 같은 조건의 새 공고가 뜨면 알림을 보내는 PWA. 데이터 공급원은 어댑터로 분리해 키가 없으면 샘플 데이터로 동작한다.

## 요구사항 정리
1. 게임: 한 번에 질문 1개, 답 3종(예/아니오/모름), 남은 후보 수가 줄어드는 게 보임, 10문항 안팎에서 결과
2. 결과: 맞는 기회 카드(분야·마감 D-day·"왜 맞는지"·"확인 필요" 조건·원문 링크)
3. 알림: 결과 조건을 저장 → 새 공고·마감 임박 시 알림(브라우저/PWA 푸시, 없으면 앱 열 때 인앱 알림)
4. 확장: 분야·공급원 추가 = 어댑터 파일 1개 + 샘플 JSON 1개
5. 키 없음 대응: `config/api_keys.csv` → `.env.local` 로 옮기면 실제 API, 없으면 `data/samples/*.json`
6. 규정: 크롤링 금지, 실제 개인정보를 외부 AI에 보내지 않음(답변은 범주값만), AI 생성 표시, 키 노출 금지

## 아키텍처
| 층 | 내용 |
|---|---|
| 프론트 | Next.js(App Router, TS) + Tailwind, PWA(manifest + service worker) |
| 데이터 모델 | `Opportunity { id, domain, title, org, region[], conditions: Condition[], applyStart, applyEnd, url, source, isSample }` / `Condition { attr, op, value, rawText, confidence }` |
| 어댑터 | `lib/sources/{lh,myhome,jobalio,benefit,youthpolicy,training,qnet,parttime}.ts` → `Opportunity[]`. 키 없으면 샘플 |
| 질문 엔진(코드) | 남은 후보를 가장 반반에 가깝게 가르는 속성을 고름(정보량 기준). 모름 = 해당 조건을 "확인 필요"로 남김 |
| AI(Claude) | ① 수집 시 자격요건 원문 → `Condition[]` 구조화(캐시) ② 질문 문장을 게임 말투로 ③ 결과 설명 "왜 맞는지". 판정은 코드 |
| 알림 | Web Push(VAPID). 구독 저장소 없으면 localStorage 프로필로 앱 열 때 비교(인앱). 하루 1회 예약 실행은 Vercel Cron(확장) |

## Patterns to Mirror
기존 코드 없음(신규 저장소). 관례를 새로 정한다: 어댑터는 `fetchX(): Promise<Opportunity[]>`, 실패 시 샘플로 폴백하고 `source`에 표시.

## Files to Change
| File | Action | Why |
|---|---|---|
| `app/` (page, play, result, alerts) | CREATE | 화면 4개 |
| `lib/types.ts` | CREATE | 공통 모델 |
| `lib/engine.ts` | CREATE | 질문 선택·후보 필터 |
| `lib/sources/*.ts` | CREATE | 공급원 어댑터 |
| `lib/ai.ts` | CREATE | Claude 호출(키 없으면 규칙 기반 문구) |
| `data/samples/*.json` | CREATE | 분야별 샘플 공고 |
| `public/sw.js`, `public/manifest.json` | CREATE | PWA·푸시 |
| `config/api_keys.csv` | CREATED | 키 기록용(gitignore) |
| `.env.example` | CREATE | 환경변수 목록 |

## Tasks
1. 뼈대: Next.js + Tailwind, 타입, 샘플 데이터 3분야(주거·혜택·구직) — Validate: `npm run build`
2. 질문 엔진 + 게임 화면 — Validate: 엔진 단위 테스트(후보 축소·모름 처리)
3. 결과 화면(D-day, 왜 맞는지, 확인 필요) — Validate: 브라우저 수동 시나리오 3개
4. 알림: 조건 저장, 인앱 새 공고 배지, Web Push 테스트 버튼 — Validate: 크롬에서 알림 수신
5. AI 연결(조건 구조화·설명) + 키 없을 때 폴백 — Validate: 키 없는 상태에서도 전체 흐름 동작
6. 나머지 분야 샘플(알바·국비과정·자격증) + 실제 API 어댑터(키 들어오면 전환)
7. 배포(Vercel) — Validate: 로그아웃 상태 링크 접속

## Codex 분담 (토큰 리필 후, 읽기 전용 → Claude가 적용)
- 분야별 샘플 공고 JSON 초안(실제 공개 공고 기반, 출처 표기)
- 각 공공 API 응답 필드 → `Opportunity` 매핑표 초안
- 완료분 교차 평가(`--review`)와 코드 리뷰

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| 차별성 약함(정책 추천과 비슷) | 높음 | 게임형 좁히기 + "모름"을 확인 필요로 남기는 정직성 + 마감 알림을 시연 핵심으로. 교차 평가로 점검 |
| API 키 미발급 | 높음 | 샘플 폴백, 화면에 "샘플 데이터" 표시 |
| 자격요건 구조화 오류 | 중간 | 원문 문장 함께 표시, 신뢰도 낮으면 "확인 필요" |
| iOS 푸시 제약 | 중간 | 인앱 알림 기본, 푸시는 지원 브라우저에서만 |
| 시간 부족 | 높음 | 1~5단계를 11/22 저녁까지, 6~7은 남는 시간 |

## Acceptance
- [ ] 키 없이 링크로 게임→결과→알림 저장까지 끊김 없이 동작
- [ ] 분야 추가가 어댑터+샘플 2파일로 가능
- [ ] 빌드·테스트 통과, 키 노출 없음
