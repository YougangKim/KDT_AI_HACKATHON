# My News — 나만의 소식통

> 예·아니오 같은 짧은 질문에 답하면, 흩어진 청년 공고(주거·지원금·채용·훈련·시험) 중 **지금 신청할 수 있는 것만** 골라 주고, 새 공고가 뜨면 알려 주는 서비스입니다.

**배포 주소:** https://kdtaihackathon-web.vercel.app

| 항목 | 내용 |
|---|---|
| 대회 | 대한상공회의소 KDT AI 해커톤 |
| 팀 | 김유강(1인, 기획·개발) |
| 형태 | 모바일 우선 웹앱(PWA), 로그인 없음 |

## 해결하려는 문제

| 문제 | My News의 해결 |
|---|---|
| 청년 공고가 LH·마이홈·정부24·고용24·온통청년 등 여러 사이트에 흩어져 있음 | 공식 공공 API 10여 곳을 서버에서 주기적으로 모아 한곳에서 보여 줌 |
| 공고마다 자격 조건(나이·소득·지역·무주택 등)이 달라 직접 읽고 판단해야 함 | 공고 원문에서 조건을 뽑아, 질문 몇 개로 "바로 신청 / 확인 필요 / 해당 없음"을 판정 |
| 놓친 뒤에야 공고를 알게 됨 | 조건을 저장하면 새 공고·마감 임박(D-3)을 푸시 알림으로 알려 줌 |

## 핵심 기능

| 기능 | 설명 |
|---|---|
| 분야 선택 → 인터뷰형 질문 | 남은 공고를 가장 잘 가르는 질문을 먼저 묻습니다. 질문마다 "예면 N개·아니오면 M개"를 보여 줍니다 |
| AI 추가 질문 | 공고 원문의 차이를 근거로 AI가 질문·선택지를 새로 만듭니다. AI가 실패하면 규칙 기반 질문으로 이어 갑니다 |
| 결과 화면 | 관련도순·마감 임박순·기한 넉넉한 최신순 정렬, 보고 싶은 수(10·20·50·전체), "추가 질문으로 N개 이하로 좁히기" |
| 빈 결과 방지 | 질문 3개 뒤 남은 공고가 10개 이하면 멈추고, 마지막 답으로 0건이 되면 직전 결과를 안내와 함께 보여 줍니다 |
| 분석 화면 | 질문별로 걸러진 공고 수, 걸러진 이유, 조건을 고치면 늘어나는 공고 수 |
| 조건 고치기 | 답을 바꾸거나 "모름"으로 두면 결과를 즉시 다시 계산합니다 |
| 지도 | 카카오 지도에 공고 위치와 내 위치·거리를 표시합니다 |
| 알림 | 조건을 저장하면 서버가 매일 다시 조회해 처음 보는 공고만 푸시합니다 |

## 데이터 출처(공식 API)

| 분야 | 출처 |
|---|---|
| 주거 | LH 청약 공고, 마이홈, 청약홈 분양정보 |
| 지원금·정책 | 정부24 공공서비스, 온통청년 청년정책 |
| 채용 | 잡알리오(공공기관 채용), 고용24 공채속보, 서울시 채용시험 |
| 훈련·시험 | 고용24 훈련과정, Q-Net 시험 일정 |
| 위치 | 카카오 지도·주소 검색 |

## 사용한 AI

| 용도 | 방식 |
|---|---|
| 공고 원문 → 자격 조건 추출, 질문 생성, 결과 요약 | Groq → OpenRouter → Cloudflare Workers AI → Gemini 순으로 자동 전환(한도 초과 시 다음 제공자) |
| 질문 품질 일관성 | 모든 제공자에 같은 지침(`web/lib/ai/question-guide.ts`, `docs/질문생성_가이드.md`)을 붙이고, 같은 검사로 걸러 냅니다 |
| AI 실패 시 | 규칙 기반 추출·질문으로 대체해 흐름이 멈추지 않습니다 |

## 구조

```
사용자(모바일 웹) ── Next.js 15 (Vercel)
                     ├─ /play     질문 화면 (판정 엔진: web/lib/engine)
                     ├─ /result   결과·지도·정렬 / /result/analysis 분석
                     ├─ /alerts   알림함 · 반복 조사 현황
                     └─ /api
                         ├─ opportunities   공고 풀(서버 캐시)
                         ├─ cron/collect · cron/scan   주기 수집 · 새 공고 감지 → 웹 푸시
                         ├─ refine-question · next-question · summary   AI
                         └─ geocode · map-config   카카오 지도
저장소: Upstash Redis(없으면 메모리)
```

| 폴더 | 역할 |
|---|---|
| `web/lib/sources` | 출처별 API 어댑터, 중복 제거, 지역 판별 |
| `web/lib/engine` | 조건 판정·질문 선택 엔진 |
| `web/lib/ai` | AI 제공자 체인, 질문 지침·검사 |
| `web/lib/server` | 공고 풀 수집, 조건 저장, 새 공고 감지 |
| `e2e` | 브라우저 시나리오 테스트(Playwright) |

## 로컬 실행

```bash
cd web
npm install
cp .env.example .env.local   # 아래 환경변수에 본인 키 입력
npm run dev                  # http://localhost:3000
npm test                     # 단위 테스트(vitest)
```

## 환경변수(값은 저장소에 없음)

| 구분 | 이름 |
|---|---|
| 공공데이터 | `DATA_GO_KR_KEY`, `WORK24_JOB_KEY`, `WORK24_TRAINING_KEY`, `SEOUL_OPEN_API_KEY`, `YOUTHCENTER_API_KEY` |
| 지도 | `KAKAO_MAP_KEY`(JavaScript 키), `KAKAO_REST_API_KEY` |
| AI | `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `GEMINI_API_KEY` (모델명은 `*_MODEL`로 변경 가능) |
| 저장소·알림 | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` |
| 선택(기본 꺼짐) | `WEB_SEARCH_ENABLED`, `TAVILY_API_KEY`, `EXA_API_KEY`, `SH_RSS_ENABLED`, `SARAMIN_ENABLED` |

키가 없는 출처는 건너뛰고, AI 키가 없으면 규칙 기반으로 동작합니다.

## 개인정보

이름·연락처·주민번호를 받지 않습니다. 답변은 브라우저에 저장되고, 알림을 켠 경우에만 예·아니오 답과 알림 구독 정보가 서버에 저장됩니다(알림함에서 삭제 가능).
