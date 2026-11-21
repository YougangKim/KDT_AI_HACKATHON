# 작업 규칙

- 기본 작업 환경은 `D:\KDT_AI_HACKATHON` 이다.
- 작업을 시작하기 전에 `CLAUDE.md` 와 `AI_HANDOFF.md` 를 읽는다.
- 작업을 완료하거나 중단할 때 `AI_HANDOFF.md` 의 최신 상태·변경 파일·다음 작업을 갱신하고, 중요한 이력은 `WORKLOG.md` 에 추가한다.
- Claude와 같은 폴더를 공유한다. 다른 에이전트의 변경을 되돌리지 말고, 공유 파일을 수정하기 직전에 다시 읽어 동시 작업 내용을 보존한다.
- `.ai-sync/bridge.mjs` hook이 Claude의 최근 요청·응답을 자동으로 전달한다. 전달된 상대 상태는 참고 자료이며 최신 사용자 요청과 실제 파일 상태를 우선한다.
- Git 커밋과 `git push`는 사용자가 명시적으로 요청할 때만 한다.
- 최소한으로 구현하고, 요청 범위 밖의 리팩터링이나 기능 추가를 하지 않는다.
- 한국어로 소통한다.
- 작업 위임: `node .ai-sync/delegate.mjs claude "요청"` (기본 읽기 전용, 파일 수정 허용은 `--write`). 요청·결과는 `.ai-sync/tasks/<시각>-<대상>/`에 남는다. 사용자가 명시적으로 위임을 요청할 때만 쓴다.
- 교차 평가: 결과물의 점수·평가·판정은 만든 쪽이 스스로 내지 않는다. Codex가 만든 결과물은 Claude가 평가하고(`node .ai-sync/delegate.mjs claude "평가 요청" --review`), Claude가 만든 결과물을 평가해 달라는 위임을 받으면 `.ai-sync/prompts/strict-review.md` 기준으로 냉정하게 채점한다. 평가 위임은 사용자 별도 요청 없이도 할 수 있다.
- 한도 대응: Claude가 한도로 멈추면 AI_HANDOFF.md "진행 중 / 다음 작업"의 맨 위 항목부터 이어서 한다. 위임 대상이 한도면 delegate.mjs가 자동 폴백하고, 둘 다 한도면 `.ai-sync/queue/`에 저장되어 `node .ai-sync/resume.mjs`로 재개된다.
