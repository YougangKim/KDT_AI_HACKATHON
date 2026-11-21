# 한 번만 실행: 30분마다 대기열(.ai-sync/queue)을 확인해 한도가 풀린 위임 작업을 자동 재개하는 Windows 작업을 등록한다.
# 대기열이 비어 있으면 아무것도 하지 않고 바로 끝난다. 해제: Unregister-ScheduledTask -TaskName AI-Sync-Resume -Confirm:$false
$root = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$root\.ai-sync\resume.mjs`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "AI-Sync-Resume" -Action $action -Trigger $trigger -Description "Claude-Codex 위임 대기열 자동 재개" -Force | Out-Null
Get-ScheduledTask -TaskName "AI-Sync-Resume" | Select-Object TaskName, State
