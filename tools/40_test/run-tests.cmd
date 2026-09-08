@echo off
rem テストを全件実行する。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-tests.ps1"
pause
