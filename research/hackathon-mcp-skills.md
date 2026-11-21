# 해커톤용 MCP·Claude 스킬/플러그인 추천 (평가순)

작성: 2026-11-19 (KST) · GitHub 스타는 2026-11-18 GitHub API로 직접 조회한 값

## 먼저 알아둘 것 (외부 검증 결과 요약)

스타는 "많이 쓰인다"는 뜻이지 "성능이 좋다"는 증거는 아닙니다. 실제 성능을 잰 연구는 대체로 냉정합니다.

- **스킬은 대부분 효과가 없다.** SWE-Skills-Bench(2026-10)는 공개 스킬 98개를 3,920쌍으로 비교했는데 92개가 유의미한 효과 없음, 평균 합격률은 76.6% → 76.9%. 일부 스킬은 최대 -17점까지 성능을 떨어뜨림. ([arXiv 2603.15401](https://arxiv.org/html/2603.15401v2))
- **웹개발 스킬은 오히려 손해일 수 있다.** WebDev-Skills-Bench는 스킬 31개 주입 시 Pass@2가 1.3~4.2% 하락, 토큰 비용 72~394% 증가. ([arXiv 2608.23067](https://arxiv.org/html/2608.23067))
- **MCP는 "실제로 할 수 없는 일"을 시킬 때 효과가 확실하다.** Playwright/GitHub MCP는 도구 없음 대비 0/26 → 30/30·35/35 성공, CLI+스킬 방식보다 토큰 1.5~2.7배 적게 사용. ([chief-builder/cli-vs-mcp](https://github.com/chief-builder/cli-vs-mcp))
- **문서 MCP(Context7)는 벤치마크상 이득이 미미했다.** Terminal-Bench 2.0에서 70.8% → 71.9%(오차 범위). ([Marginlab](https://marginlab.ai/blog/do-mcps-improve-coding-agents-part-1/))
- **워크플로 팩은 하나만.** Superpowers·ECC·gstack 등은 각자 `/plan`, `/tdd` 같은 라우터를 갖고 있어 두 개 이상 깔면 충돌. ([ReviewRamble](https://www.reviewramble.com/claude-code-workflow-plugins-compared/), [Nebutra](https://nebutra.com/blog/claude-code-skill-frameworks-autopsy))

결론: **MCP는 3~6개, 워크플로 팩은 1개**가 여러 리뷰의 공통 권고입니다.

---

## 1. 스킬·플러그인 팩 (ECC 대체/유사품) — 평가순

순위는 스타 + 독립 리뷰 평점을 함께 봤습니다. 리뷰 평점은 ReviewRamble 5점 척도.

| 순위 | 이름 | ★ 스타 | 외부 평가 근거 | 용도 | 설치 |
|---|---|---|---|---|---|
| 1 | [obra/superpowers](https://github.com/obra/superpowers) | 319,812 | ReviewRamble **4.7**(최고점), Nebutra "행동 변화·강제 규칙 밀도" 최고점(4·5/5), HowToGeek 100개 테스트 중 추천 | 브레인스토밍→계획→TDD→리뷰→검증을 강제. "테스트 안 돌렸으면 완료라고 말하지 마라" 같은 게이트 | `/plugin install superpowers@claude-plugins-official` |
| 2 | [mattpocock/skills](https://github.com/mattpocock/skills) | 327,267 | ReviewRamble **4.5** | 가벼운 단일 목적 스킬. `/grill-me`로 요구사항을 하나씩 질문해 합의 → 아이데이션·기획 단계에 적합 | 저장소 README 참고(리포별 1회 설정) |
| 3 | [anthropics/skills](https://github.com/anthropics/skills) (공식) | 197,062 | Anthropic 1st-party, BSWEN "가장 단순·저위험" | pptx·docx·xlsx·pdf·frontend-design 등. **발표자료·문서 산출물에 바로 유용** | `/plugin marketplace add anthropics/skills` |
| 4 | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 118,863 | ReviewRamble **4.3** | 스펙→출시 25개 스킬·9개 명령, 브라우저 테스트·성능 포함. 단계마다 사람 확인 | README 참고. 기본 `/review`와 이름 충돌 주의 |
| 5 | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) (공식 마켓) | 47,634 | ReviewRamble **4.3**, 기본 활성화 | 공식 플러그인 마켓. 서드파티보다 먼저 볼 곳 (단, 등재 ≠ 보안 감사) | Claude Code에 기본 포함, `/plugin` |
| 6 | [affaan-m/ECC](https://github.com/affaan-m/ECC) (설치 중인 것) | 306,218 | ReviewRamble **3.8**, BSWEN "조건부 추천", Nebutra "컨텍스트 세금" 지적 | 에이전트·스킬·훅·메모리·AgentShield 보안 스캐너 종합 키트 | **`--profile minimal` 등 작은 프로필 권장**. 개명·미러가 있으니 `affaan-m/ECC` 공식만 |
| 7 | [garrytan/gstack](https://github.com/garrytan/gstack) | 141,989 | Nebutra 낮은 점수(2/5), 단 "1인 빠른 반복"엔 적합 평가 | 역할극형 워크플로, 자동 수정·자동 커밋 | README. 공유 브랜치에서 자동수정 주의 |
| 8 | [wshobson/agents](https://github.com/wshobson/agents) | 42,653 | 독립 벤치마크 없음 | 분야별 서브에이전트 모음 | README |

**해커톤 추천:** ECC를 이미 설치 중이면 ECC는 최소 프로필로 두고 **Superpowers는 추가하지 마세요**(라우터 충돌). 대신 충돌이 적은 `anthropics/skills`(발표자료용)와 `mattpocock/skills`의 `/grill-me`(기획용)만 골라 쓰는 조합을 권합니다. ECC 대신 하나만 고른다면 리뷰 평점 1위는 Superpowers입니다.

---

## 2. MCP 서버 — 평가순

| 순위 | 이름 | ★ 스타 | 외부 평가 근거 | 해커톤 용도 | 설치 |
|---|---|---|---|---|---|
| 1 | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) (공식) | 39,846 | **벤치마크 30/30 성공**, CLI 대비 토큰 1.5~2.7배 절감. 거의 모든 "추천 5선"에 포함 | 만든 웹앱을 브라우저로 직접 확인·E2E 테스트·데모 검증 | `claude mcp add playwright -- npx @playwright/mcp@latest` |
| 2 | [github/github-mcp-server](https://github.com/github/github-mcp-server) (공식) | 34,567 | **벤치마크 35/35 성공**, Nimbalyst "가장 영향 큰 설치" | 이슈·PR·Actions 관리 | `claude mcp add --transport http github https://api.githubcopilot.com/mcp` |
| 3 | [upstash/context7](https://github.com/upstash/context7) | 65,068 | 거의 모든 리스트 상위, mcp.market 안전등급 A. **단 Terminal-Bench에선 개선 미미** | 최신 라이브러리 문서 조회(낯선 SDK 쓸 때) | `claude mcp add context7 -- npx -y @upstash/context7-mcp` |
| 4 | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) (공식) | 58,174 | 구글 공식, SkillScout 2위 | 콘솔·네트워크·성능 디버깅 (Playwright와 역할 겹침, 하나만) | `claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest` |
| 5 | [exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server) | 5,241 | Nimbalyst 추천 5선 | 아이데이션·시장조사·경쟁사 리서치 (이미 연결됨) | `claude mcp add exa -- npx -y exa-mcp-server` + API 키 |
| 6 | [tavily-ai/tavily-mcp](https://github.com/tavily-ai/tavily-mcp) | 2,496 | 공식 | 최신 뉴스·일반 검색 (현재 로그인 만료 상태) | 공식 README |
| 7 | [oraios/serena](https://github.com/oraios/serena) | 31,504 | 여러 랭킹 상위 | 심볼 단위 코드 검색·편집. 코드가 커질 때 유용 | README (uvx 기반) |
| 8 | [mksglu/context-mode](https://github.com/mksglu/context-mode) | 34,267 | 자체 주장 "컨텍스트 99% 절감"(독립 검증 없음) | 긴 도구 출력이 컨텍스트를 잡아먹는 것 방지 | README |
| 9 | [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | 48,820 | 자체 주장 위주 | 코드베이스 지식 그래프 | README |
| 10 | [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP) | 16,248 | 독립 벤치마크 없음 | 피그마 디자인 → 코드 (디자인 팀원이 있으면) | README |
| 11 | [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp) | 23,282 | 독립 벤치마크 없음 | n8n 자동화 워크플로를 서비스에 쓸 때 | README |
| 12 | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | 118,168 | 스타 많음. Nimbalyst는 "기본 메모리로 충분, 여러 에이전트 공유 시만" | 세션 간 기억 유지 | README. 해커톤 기간엔 CLAUDE.md로 충분 |

**굳이 안 깔아도 되는 것:** Filesystem·Sequential Thinking·Memory MCP는 Claude Code 기본 기능과 겹친다는 평가가 다수입니다([Nimbalyst](https://nimbalyst.com/blog/best-claude-code-mcp-servers/)).

---

## 3. 위험·주의 표시

- ⚠️ **morluto/rea (★467,739)**: 여러 랭킹 1위지만 주간 +17,000 스타로 급증 중이고 용도가 리버스 엔지니어링이라 해커톤과 무관. 스타 수만 보고 설치하지 마세요.
- ⚠️ **ECC 미러/구 이름**: `everything-claude-code` 이름의 재배포본이 있습니다. 공식은 `github.com/affaan-m/ECC`.
- ⚠️ **ProtocolProbe 지적**: MCP 레지스트리는 게시자가 저장소 주인인지 검증하지 않음(예: paperclip 저장소를 다른 계정이 등록). 설치는 저장소 공식 README의 명령으로.
- ⚠️ **훅·MCP는 내 PC에서 코드를 실행**합니다. 플러그인 설치 전 `hooks/hooks.json`, `.mcp.json`을 열어보세요. 토큰은 최소 권한으로.
- ⚠️ **BeehiveInnovations/pal-mcp-server**(구 zen-mcp): 마지막 푸시 2025-12, 사실상 정체.

---

## 4. 해커톤 단계별 최소 세트 (제안)

| 단계 | 쓸 것 |
|---|---|
| 아이데이션 | Exa(·Tavily) MCP, `mattpocock/skills`의 `/grill-me` |
| 기획 | ECC 최소 프로필 또는 Superpowers 중 **하나**의 계획 스킬 |
| 개발 | GitHub MCP, Context7, Playwright MCP |
| 발표 | `anthropics/skills`의 pptx·docx 스킬 |

## 출처

- 스타·활동일: GitHub Search API 직접 조회 (2026-11-18)
- 랭킹: [MCP Harbor](https://mcpharbor.app/mcp-servers-for/claude-code/), [SkillScout](https://skillscout.si/mcp-servers), [mcp.market 리더보드](https://mcp.market/leaderboard), [ProtocolProbe](https://protocolprobe.com/mcp/servers/top/stars)
- 리뷰: [ReviewRamble 비교](https://www.reviewramble.com/claude-code-workflow-plugins-compared/), [Nebutra 해부](https://nebutra.com/blog/claude-code-skill-frameworks-autopsy), [BSWEN ECC 평가](https://docs.bswen.com/blog/2026-09-07-is-everything-claude-code-worth-it/), [UPeak](https://upeak.io/blog/best-claude-code-plugins-skills-and-github-repos/), [HowToGeek](https://www.howtogeek.com/the-best-claude-code-plugins/), [Nimbalyst](https://nimbalyst.com/blog/best-claude-code-mcp-servers/)
- 벤치마크: [SWE-Skills-Bench](https://arxiv.org/html/2603.15401v2), [WebDev-Skills-Bench](https://arxiv.org/html/2608.23067), [cli-vs-mcp](https://github.com/chief-builder/cli-vs-mcp), [Marginlab Context7](https://marginlab.ai/blog/do-mcps-improve-coding-agents-part-1/)
- 검색 도구: Exa MCP 사용 (Tavily는 로그인 만료로 미사용)
