@echo off
rem C# 版の MCP サーバーをビルドする。.NET Framework 同梱の csc.exe を使う。
cd /d "%~dp0"

set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
	echo csc.exe が見つかりません。.NET Framework 4.x が入っているか確認してください
	pause
	exit /b 1
)

"%CSC%" /nologo /optimize /utf8output /out:mcp-server.exe /r:System.Web.Extensions.dll Server.cs
if errorlevel 1 (
	echo ビルドに失敗しました
	pause
	exit /b 1
)

echo できました: mcp-server.exe
pause
