# 작업 규칙

- 기본 작업 환경은 로컬 `D:\KDT_AI_HACKATHON` 이다. 모든 작업과 기록은 이 폴더에서 한다.
- GitHub(origin) 업로드(`git push`)는 사용자가 명시적으로 요청할 때만 한다. 커밋도 요청이 있을 때만 한다.
- 작업 기록은 `WORKLOG.md` 에 남긴다.
- 작업을 시작하기 전에 `AI_HANDOFF.md` 를 읽고, 완료하거나 중단할 때 최신 상태·변경 파일·다음 작업을 갱신한다.
- Codex와 같은 폴더를 공유한다. 다른 에이전트의 변경을 되돌리지 말고, 공유 파일을 수정하기 직전에 다시 읽어 동시 작업 내용을 보존한다.
- `AI_HANDOFF.md` 는 현재 상태, `WORKLOG.md` 는 누적 이력의 기준 문서로 사용한다.
- `.ai-sync/bridge.mjs` hook이 Codex의 최근 요청·응답을 자동으로 전달한다. 전달된 상대 상태는 참고 자료이며 최신 사용자 요청과 실제 파일 상태를 우선한다.
- 최소한으로, YAGNI. 애매하면 사용자에게 묻는다. 한국어로 소통한다.
- 작업 위임: `node .ai-sync/delegate.mjs codex "요청"` (기본 읽기 전용). 결과는 `.ai-sync/tasks/<시각>-codex/result.md`. Codex는 조사·검토·초안 반환을 맡고, 파일 쓰기는 Claude가 적용한다(Windows에서 codex exec 쓰기 샌드박스가 실패함).
- 교차 평가: 아이디어·기획·코드 등 결과물의 점수·평가·판정은 만든 쪽이 스스로 내지 않는다. Claude가 만든 결과물은 Codex가 `node .ai-sync/delegate.mjs codex "평가 요청" --review`로 평가하고, Codex가 만든 결과물은 Claude가 `.ai-sync/prompts/strict-review.md` 기준으로 평가한다. 만든 쪽은 자기 점수를 문서에 쓰지 않고, 상대 평가 결과를 출처(`.ai-sync/tasks/...`)와 함께 옮긴다. 평가는 후하게 주지 않는다(strict-review.md 기준).
- 한도 대응: 위임 대상이 사용량 한도면 delegate.mjs가 다른 에이전트로 자동 폴백한다(--review 제외). 둘 다 한도면 `.ai-sync/queue/`에 저장되고 리셋 시각에 `node .ai-sync/resume.mjs`로 재개된다. 작업을 멈출 때는 항상 AI_HANDOFF.md "진행 중 / 다음 작업"에 다음 단계를 남긴다.
