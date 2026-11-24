# 무료 AI 체인·토큰 확보 조사 (2026-11-24)

- 조사: Codex(Exa 검색, 공식 문서 직접 확인) — 원본 `.ai-sync/tasks/20261123T171842-codex/result.md`
- 검토·보강: Claude — Groq 약관 원문, Z.AI 가격표 직접 재확인, 무료 AI 묶음 MCP·게이트웨이 오픈소스 추가 조사(4장)
- 코드 수정 없음. 수치는 자주 바뀌므로 적용 전 각 콘솔의 Limits 화면을 최종값으로 본다.

## 1. 결론

1. 서버 하나로 "무제한 무료"는 없다. 다수 사용자 대응은 **캐시·질문 승격 풀로 호출 자체를 줄이고**, 그 위에 무료 제공자 여러 곳을 **제공자당 계정 1개**로 쌓는 방식이 유일하게 약관상 안전하다.
2. 새로 추가할 가치가 있는 무료 제공자는 **Z.AI `GLM-4.7-Flash`/`GLM-4.5-Flash`(토큰 가격 Free, 공식 가격표 직접 확인)**. 한도(RPM/RPD)는 비공개라 쿨다운·회로차단기 필요.
3. **SambaNova 무료(Preview)·NVIDIA Build·GitHub Models 무료**는 공식적으로 평가·프로토타입용 → 서비스 체인에서 제외.
4. **다중 계정·조직으로 한도 우회는 Groq가 약관에 명시 금지**(원문 직접 확인, 5장), OpenRouter도 금지. 대회 실격 위험이므로 배제.
5. 사용자가 많아질 때의 확장은 ① OpenRouter **$10 1회 충전(무료 모델 50→1,000회/일)**, ② **사용자 부담 모드(OpenRouter OAuth PKCE 또는 Puter.js)**, ③ 학생·법인 자격이 있으면 크레딧 프로그램 순.

## 2. 제공자 비교 (서비스 체인 후보 중심)

| 제공자 | 무료 한도 | 한국어·JSON 후보 | 서버(다수 사용자) 사용 | 판정 | 출처 |
|---|---|---|---|---|---|
| Groq | gpt-oss-120b 30 RPM · 1,000 RPD · 8K TPM · 200K TPD, 카드 불필요 | `openai/gpt-oss-120b` | 가능(조직 단위 한도) | **유지 1순위** | [한도](https://console.groq.com/docs/rate-limits) |
| Gemini API | Flash-Lite 무료. RPM/RPD는 AI Studio 프로젝트별 표시값이 최종(기존 10/500은 공식 고정 수치로 재확인 안 됨) | Flash-Lite | 가능. 무료 티어 입력은 제품 개선에 쓰일 수 있음 → 개인정보 제외 유지 | **유지** | [한도](https://ai.google.dev/gemini-api/docs/rate-limits) |
| Z.AI(GLM) | GLM-4.7-Flash·4.5-Flash·4.6V-Flash 토큰 무료, RPM/RPD 비공개 | `glm-4.7-flash` | 가격표상 무료, SLA 없음 | **추가 추천** | [가격](https://docs.z.ai/guides/overview/pricing) |
| OpenRouter `:free` | 누적 구매 $10 미만 20 RPM·50 RPD, $10 이상 20 RPM·1,000 RPD | 무료 Qwen·Gemma 등(자주 바뀜) | 가능 | **유지, $10 충전 시 효과 큼** | [한도](https://openrouter.ai/docs/api-reference/limits) |
| Cloudflare Workers AI | 10,000 neurons/일 | Qwen·Llama | 프로덕션 가능 | **유지(후순위)** | [가격](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Cerebras | 무료 티어 존재(정확한 값은 계정 Limits). 일부 목록은 $5 체험 크레딧으로 표기 | Qwen | 무료 용량의 상업 조건 미확인 | 보류 | [가격](https://www.cerebras.ai/pricing) |
| Mistral | Experiment 무료 플랜 존재, 낮은 한도 | Mistral Small | 실험용 | 보류 | [티어](https://docs.mistral.ai/deployment/laplateforme/tier/) |
| Alibaba Model Studio(국제) | 신규 계정 모델별 약 100만 토큰·90일, 재가입 재지급 없음 | Qwen Plus | 가능 | 일회성 보조 | [무료 쿼터](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/new-free-quota) |
| Vercel AI Gateway | 월 무료 크레딧(과거 $5 발표, 현재 문서는 금액 미표기) | 여러 공급자 | 프로덕션 가능 | 채택 후보 | [가격](https://vercel.com/docs/ai-gateway/pricing) |
| Hugging Face | 무료 월 $0.10 | — | 실험 규모 | 부적합 | [가격](https://huggingface.co/docs/inference-providers/main/en/pricing) |
| SambaNova | 모델별 20 RPM·20 RPD | gpt-oss-120b | **Preview는 프로덕션 금지** | 배제 | [한도](https://docs.sambanova.ai/docs/en/models/rate-limits) |
| NVIDIA Build | 무료(고정 수치 재확인 안 됨) | Nemotron·Qwen | **프로토타입·평가용** | 배제 | [약관](https://www.nvidia.com/en-us/data-center/products/nvidia-api/terms-of-use/) |
| GitHub Models | 등급별 무료 한도 | GPT-4o mini 등 | **프로토타이핑용** | 배제(데모 외) | [한도](https://docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits) |
| Cohere | Trial key | Command | 평가용, 상업 배포 비권장 | 배제 | [약관](https://cohere.com/terms-of-use) |
| Upstage Solar | 상시 무료 크레딧 미확인(유료, Tier0 100 RPM) | `solar-mini-4` 한국어 강점 | 프로덕션 가능 | **유료 안전망 후보** | [가격](https://www.upstage.ai/pricing/api) |
| NAVER CLOVA Studio | 테스트 키는 서비스 앱 호출 불가 | HCX-007 | 서비스 키 필요(유료) | 부적합 | [키 정책](https://guide.ncloud-docs.com/docs/en/clovastudio-apikey) |
| LG K-EXAONE | 무료 공개 발표 있음, 한도·약관 미확인 | K-EXAONE | 미확인 | 확인 후 검토 | [문서](https://docs.exaone.ai/) |
| Together·Fireworks·Novita·SiliconFlow·DeepSeek·Scaleway·OVH·Kluster·Chutes·LLM7·KT·Kakao | 상시 무료 한도 또는 서버 사용 약관을 공식 문서로 확인 못 함 | — | — | 미확인 | Codex 원본 표 참고 |

## 3. 추천 체인 (현재 대비 변경점)

```
Upstash 응답 캐시 → 질문 승격 풀(검증된 질문 재사용)
 → Groq gpt-oss-120b → Gemini Flash-Lite → Z.AI GLM-4.7-Flash(신규)
 → OpenRouter :free(allowlist) → Cloudflare Workers AI
 → (선택) 유료 안전망: Upstage Solar Mini 또는 Anthropic → 규칙 기반 응답
```

- Gemini를 OpenRouter·Cloudflare 앞으로(한국어·JSON 안정성).
- GLM-4.7-Flash 추가(OpenAI 호환이라 기존 fetch 체인에 한 항목 추가 수준). 한도 비공개라 429 시 쿨다운.
- OpenRouter 무료 모델은 자주 폐기(이미 404 경험)되므로 사전 JSON·한국어 테스트를 통과한 모델만 allowlist.
- 제공자별 RPM·RPD·429·`Retry-After`를 따로 추적.

대략의 하루 용량(공식 한도 기준, 질문 1회 = 호출 1회 가정): Groq 1,000 + OpenRouter 50(충전 시 1,000) + Gemini(프로젝트 표시값) + GLM(비공개) + Cloudflare 소량. 캐시·승격 풀 적중률만큼 실제 수용 사용자 수가 늘어난다.

## 4. 무료 AI를 묶은 MCP·게이트웨이 오픈소스 (Claude 추가 조사)

여러 무료 티어를 하나의 OpenAI 호환 엔드포인트로 묶고 MCP 서버도 제공하는 프로젝트가 실제로 여럿 있다. 공통점은 **로컬/상시 실행 프록시**라는 점이다.

| 프로젝트 | 내용 | MCP | 이 앱(Vercel 서버리스) 런타임 | 개발 도구로 |
|---|---|---|---|---|
| [freellmpool](https://github.com/0xzr/freellmpool) | 23개 제공자, 178 경로, 키 없이 시작 가능, Retry-After·회로차단기, 일일 사용량 추적. Python CLI·라이브러리·프록시 | stdio MCP(ask, quota 등) | 부적합(Python 상시 프로세스) | **적합** — Claude/Codex 한도 부족 시 하위 작업 위임 |
| [freellmapi](https://github.com/xMissy-the-Sissi/freellmapi) | 18개 제공자를 `/v1` 하나로, 키 암호화 저장, 429 시 다음 제공자 | HTTP MCP `/mcp` | 부적합(별도 서버) | 적합. 단 같은 제공자 키 여러 개 회전 기능은 끌 것 |
| [free-llm-hub](https://github.com/last-million/free-llm-hub) | 57개 제공자, OpenAI·Anthropic·Gemini 형식 동시 지원, CLI 연결 버튼 | 있음 | 부적합 | 적합(Codex·Claude Code 연결) |
| [freeiaforge](https://github.com/MAXIAWORLD/freeiaforge) | 9개 제공자+Ollama, 쿼터 추적·의미 캐시·회로차단기 | HTTP MCP | 부적합 | 보통 |
| [mast-llm-router](https://github.com/m4stanuj/mast-llm-router) | 작업 유형별(코드·추론 등) 무료 모델 체인 | MCP | 부적합 | 보통 |
| [free-llm-router](https://github.com/waseemnasir2k26/free-llm-router) | 의존성 없는 단일 프록시, `free: true` 모델만 호출(유료 차단), 폐기 모델 자동 제외 | 없음 | 부적합(상시 프록시) | **설계 참고 가치 높음** |
| [cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) | 무료 API 목록 | — | 후보 발굴용 | 참고 |
| LiteLLM / any-llm | Python 라우터 | — | 부적합 | — |
| Vercel AI SDK | Next.js 네이티브 공급자 어댑터 | — | 적합하나 현 fetch 체인으로 충분(YAGNI) | — |

판단
- **런타임 앱에는 MCP가 필요 없다.** 앱은 지금처럼 `web/lib/ai/providers` 체인을 유지하고, 위 프로젝트에서 **설계만 가져온다**: `free: true` 가드, 폐기 모델(404/410) 자동 제외 TTL, `Retry-After` 존중, 회로차단기.
- **개발 쪽 가치는 크다.** 이번 주처럼 Claude 한도가 부족할 때 freellmpool이나 free-llm-hub를 로컬에 띄워 MCP로 연결하면 요약·초안 같은 하위 작업을 무료 모델로 넘길 수 있다(설치는 사용자 승인 후).
- 주의: 이들 저장소의 한도 수치는 대부분 비공식(free-llm-hub도 일부를 스스로 미확인으로 표기). 같은 제공자 키 여러 개를 돌리는 기능은 5장 약관 위반에 해당할 수 있으니 끈다. 별 수·유지보수 상태는 설치 전 확인 필요.

## 5. 약관 위반 위험 — 배제 목록 (대회 실격 위험)

| 방식 | 근거 | 판정 |
|---|---|---|
| Groq 계정·조직 여러 개로 요청 분산 | Groq AUP(2025-10-15 시행): 공개 한도를 넘는 사용 금지, 다중 계정 등록·여러 조직 간 사용 분산을 명시 — [원문](https://console.groq.com/docs/legal/ai-policy) (Claude 직접 확인) | **배제** |
| OpenRouter 다중 계정으로 무료 한도 우회 | 제한 회피 목적 다중 계정 금지, 키를 늘려도 한도는 안 늘어남 — [약관](https://openrouter.ai/terms), [한도](https://openrouter.ai/docs/api-reference/limits) | **배제** |
| Alibaba 재가입으로 무료 쿼터 반복 | 재가입 계정 재지급 없음 | **배제** |
| 같은 조직 키 여러 개로 총량 증가 가정(Groq·Gemini·Upstage) | 한도가 조직·프로젝트 단위 | 효과 없음 |
| SambaNova Preview·NVIDIA Build·GitHub Models 무료를 상시 서비스에 연결 | 평가·프로토타입 목적 명시 | **배제** |
| 게이트웨이의 키 회전 기능으로 동일 제공자 여러 계정 사용 | 위 금지 조항과 같은 효과 | **배제** |

참고: Groq AUP에는 고용·주거·사회복지 같은 고위험 분야에서 사람 감독 없이 개인에게 중대한 불이익을 주는 자동 결정을 금지하는 조항도 있다. My News는 공고 추천·질문 생성이고 최종 판단은 사용자가 원문으로 확인하므로 해당하지 않지만, 발표에서 "AI가 자격을 판정한다"는 표현은 피하는 게 안전하다.

## 6. 크레딧 프로그램 (개인이 지금 받을 수 있는지)

| 프로그램 | 혜택 | 개인 신청 | 비고 |
|---|---|---|---|
| Azure for Students | 카드 없이 Azure 크레딧 | **학생 인증 시 가능** | Azure OpenAI 사용 가능 여부는 구독 정책 확인 |
| Microsoft for Startups Founders Hub | 단계별 Azure 크레딧 | 스타트업 프로젝트로 신청, 승인 필요 | |
| AWS Activate Founders | $1,000(Bedrock 사용 가능) | 회사 웹사이트·스타트업 요건 | 개인 단독은 어려움 |
| Google for Startups Cloud | 단계별 크레딧 | 사업체 요건 | |
| Upstage 교육·공익기관 | Solar 최대 1년 무료 | 학교·비영리 기관만 | |
| NVIDIA Inception | 생태계 혜택(API 크레딧 고정액 미확인) | 스타트업 | |
| Anthropic·OpenAI·Groq 스타트업 | 공개 고정 크레딧 미확인 | VC·문의형 | |
| NIPA 클라우드·AI 바우처 | 기업 대상 공모 | 개인 불가 | 대회 기간 내 조달 부적합 |

## 7. 사용자 부담 방식

| 방식 | 장점 | 단점 | 판정 |
|---|---|---|---|
| OpenRouter OAuth PKCE | 비밀번호 안 다룸, 사용자 키·예산 한도, 다수 모델 | OpenRouter 가입 필요 | **사용자 부담 모드 1순위** |
| Puter.js | 사용자별 무료 할당·과금, 개발자 비용 0, 키 보관 없음 | Puter 로그인, 브라우저에서 호출(서버 체인과 분리) | 채택 후보 |
| 사용자 키 직접 입력(BYOK) | 총량 큼 | 일반 사용자 UX 나쁨, 키 보관 책임 | 고급 옵션 |
| 서버 공용 키(현행) | UX 최고 | 한도 집중 | 기본 경로 유지 |

권장 UX: 기본은 공용 체인, 한도 소진 시 "AI 질문이 잠시 쉬어요 → 규칙 질문으로 계속" + 선택적으로 "내 OpenRouter로 계속하기" 버튼.

## 8. 바로 할 수 있는 일 (우선순위)

1. Z.AI 가입 → GLM-4.7-Flash 키를 체인에 추가(코드 소량, 사용자 승인 후).
2. OpenRouter $10 1회 충전 검토(무료 모델 50→1,000회/일). 결제는 사용자가 직접.
3. 체인에 폐기 모델 TTL 제외·`Retry-After` 존중 추가(free-llm-router 설계 참고).
4. 개발용: freellmpool 또는 free-llm-hub를 로컬 MCP로 연결해 Claude 한도 부족 시 하위 작업 위임(설치 승인 필요).
5. 사용자 부담 모드(OpenRouter OAuth)는 대회 이후 후보.

## 9. 미확인 항목

Gemini Flash-Lite 고정 RPM/RPD, Cerebras·Mistral 무료 정확 한도, GLM Flash RPM, Vercel AI Gateway 월 크레딧 금액, Together·Fireworks·Novita·SiliconFlow 신규 크레딧, K-EXAONE 무료 API 한도·약관, Pollinations 익명 한도, 오픈소스 게이트웨이들이 적은 한도 수치 전부.
