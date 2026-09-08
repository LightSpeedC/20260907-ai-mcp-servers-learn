@echo off
rem toast.ps1 の動作確認用。ダブルクリックするとトーストが 1 件出る。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0toast.ps1" -Title "MCP 学習資料" -Message "トーストの動作確認"
pause
