# 리서치·크롤링 도구 설치 결과와 앱 적용 판단 (2026-11-21)

## 설치 결과

| 도구 | 상태 | 설치 위치·범위 | 비고 |
|---|---|---|---|
| Scrapling 0.5.1 (`scrapling[all]`) | 설치 | 프로젝트 전용 가상환경 `.venv-tools/` (gitignore 추가) | `scrapling install`(스텔스 브라우저 다운로드)은 실행 안 함. 기본 `Fetcher`(HTTP)만 사용. 기본값으로 Google referer를 붙이므로 공공기관 조회 시 `stealthy_headers=False` 권장 |
| agent-browser 0.43.0 | 설치 | npm 전역 + Chrome for Testing 158 (`~/.agent-browser/browsers`) | vercel-labs 공식. postinstall은 자기 GitHub 릴리스에서 바이너리만 받음. ECC `e2e-runner`가 우선 사용하는 도구라 충돌 없이 보완 |
| k-skill | 일부 설치 | 프로젝트 `.claude/skills/`, `.agents/skills/`(Codex) | 140개 `--all -g` 대신 관련 9개만: k-skill-setup, lh-notice-search, sh-notice-search, housing-subscription-reference, kstartup-search, korean-scholarship-search, government-support-survey, kosis-stats, korean-law-search. 훅·.mcp.json 없음 |
| insane-search 0.17.6 (+gptaku-core 0.2.4) | 설치(11:00, 사용자 결정: 개발용만) | 프로젝트 범위 `.claude/settings.json` enabledPlugins | 라우터 훅 끔(`env.GPTAKU_ROUTER=off`), 셋업 마커를 미리 만들어 전역 훅 설치·대화 기록 읽기 생략. 대회 앱 런타임에는 쓰지 않음. Claude는 공개 페이지 읽기(일반 경로)만 쓰고 WAF·CAPTCHA 우회 단계는 쓰지 않음 |
| Firecrawl | 보류 | 미설치 | 계정·키 필요(요청대로) |

### insane-search 처리 (처음 보류 → 사용자 결정으로 개발용 설치)
- ECC 충돌 처리: gptaku-core 훅 3개(SessionStart 우선 규칙, UserPromptSubmit 라우터, WebFetch 차단 시 우회 재시도)는 모두 `GPTAKU_ROUTER=off`면 즉시 종료한다. 프로젝트 settings `env`에 넣어 꺼 두었다(직접 실행해 출력 없음 확인). 스킬은 명시적으로 부를 때만 동작한다. 다시 켜려면 그 줄을 지운다.
- 셋업 스크립트: `~/.gptaku-setup/insane-search.json`·`.star.json` 마커를 미리 만들어, 첫 실행 시 전역 `~/.claude/settings.json`에 업데이트 알림 훅을 넣는 단계와 대화 기록으로 언어를 추정하는 단계가 건너뛰어진다.

처음 보류했던 사유(참고):
1. 핵심 기능이 차단 우회다: README가 403·WAF·CAPTCHA를 "뚫는다"고 소개하고, curl_cffi TLS 위장·patchright/nodriver 스텔스 브라우저·`waf_detector`를 쓴다. 봇 탐지 우회는 대회 약관 위반 데이터 리스크이고, 에이전트 안전 규칙상으로도 쓰지 않는다.
2. 의존 플러그인 gptaku-core가 모든 세션에 `<EXTREMELY_IMPORTANT>` 규칙을 넣어 WebSearch·WebFetch·Bash보다 자기 스킬을 먼저 부르게 하고, WebFetch가 403/429/Cloudflare로 막히면 우회 스킬로 재시도하게 한다. ECC·브리지 훅과 지시가 겹치는 라우터 충돌이 생긴다.
3. `setup/setup.sh`가 최근 Claude 대화 기록(`~/.claude/projects/**.jsonl`) 20개를 읽어 언어를 추정하고, 업데이트 알림 훅을 설치한다.
훅 코드 자체에 외부 전송은 없었다(검토 범위: gptaku-core hooks 5개, insane-search setup).

## ECC 충돌 확인
- 설치한 것 중 훅을 거는 도구는 없다(Scrapling 라이브러리, agent-browser CLI, k-skill은 SKILL.md+스크립트).
- k-skill은 프로젝트 범위라 다른 프로젝트 세션에 영향 없음. 스킬 이름이 ECC와 겹치지 않음.

## 앱(마이뉴스) 적용 판단

### 서비스 런타임
- **LH**: 이미 공식 API(data.go.kr 15058530)로 `web/lib/sources/lh-notice.ts`에 연결되어 있다. k-skill 방식(공식 사이트 목록 조회·k-skill-proxy)은 필요 없다.
- **k-skill-proxy(nomadamas.org)**: 제3자 서버 경유라 런타임에 쓰지 않는다(가용성·약관 책임을 남에게 의존).
- **SH(서울주택도시공사) 공고 게시판**: 유일한 실익 후보. `i-sh.co.kr/robots.txt`는 게시판 경로(`/app/lay2/...`)를 막지 않고, 메인에서 별도 이용약관 링크는 못 찾았다("이메일 무단수집 거부" 고지만 있음). 서울 청년 주거 공고(역세권 청년주택 등)를 보강할 수 있다. 붙인다면 `WEB_SEARCH_ENABLED`처럼 **기본 OFF** 환경변수(예: `SH_NOTICE_ENABLED=1`), 목록 제목·링크·게시일만, 하루 1회 저빈도, 정직한 User-Agent로. 저작권·이용 고지 페이지를 사람이 한 번 확인한 뒤에만 켠다. → 코드는 `web/` 담당 통합 스레드에 요청.
- 마이홈(myhome.go.kr)은 이미 어댑터가 있고 robots도 허용.
- 민간 플랫폼(잡코리아·사람인·당근 등) 크롤링: 금지. k-skill의 해당 스킬은 설치하지 않았다.

### 개발용(자유)
- agent-browser: E2E 시연 흐름 자동 실행·스크린샷·녹화, 배포본 점검.
- Scrapling `Fetcher`: 공공 API 문서·공고 상세 구조 확인, 샘플 데이터 갱신 검토.
- k-skill: lh/sh/kstartup/장학금 스킬로 실제 공고 구조 파악, kosis-stats로 발표용 청년 통계 원문 확인, housing-subscription-reference로 청약 가점 규칙 확인.

## SH 약관 확인 (11:45)
- 이용약관: https://www.i-sh.co.kr/main/lay2/S1T1272C1404/contents.do — 회원 의무 조항에 "서비스에서 얻은 정보를 복제, 출판 또는 제3자에게 제공하는 행위" 금지. 자동 수집을 직접 금지하는 조항은 못 찾음. 공공누리 표시도 메인·약관·이용안내 페이지에서 못 찾음
- 공식 RSS: https://www.i-sh.co.kr/main/lay2/S1T1272C1408/contents.do — "공고 및 공지" 피드 `.../S1T294C295/www/rss/rssNoticeWrite.do` 제공(EUC-KR, 정상 응답 확인). "블로그나 리더기에 등록하여 이용"하라는 안내
- 권장: 게시판 크롤링 대신 공식 RSS를 기본 OFF 옵션으로, 제목·링크·게시일만 쓰고 본문(content:encoded)은 저장하지 않으며 원문 링크로 보냄. 복제·제3자 제공 조항과 충돌 소지가 남으므로 시연에서는 "SH 공식 RSS 링크 안내"로 표기
