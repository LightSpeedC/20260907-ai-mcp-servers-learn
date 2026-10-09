#requires -Version 5.1
<#
.SYNOPSIS
	テストを全件実行する。

.DESCRIPTION
	tests/ 配下のテストを直列で実行する。
	並列にすると待ち受けポートが取り合いになるため --test-concurrency=1 を付けている。

	node に渡す対象は必ず絶対パスにする。渡し損ねると node は
	カレントディレクトリ配下を丸ごと探しに行き、関係の無いファイルまで実行してしまう。

.EXAMPLE
	.\run-tests.ps1
	.\run-tests.ps1 -Filter 09-tasks
#>
param(
	# ファイル名の一部で絞り込む（省略時は全件）
	[string]$Filter
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$testDir = Join-Path $root 'tests'

if (-not (Test-Path -LiteralPath $testDir)) {
	throw "tests フォルダが見つかりません: $($testDir.Replace($env:USERPROFILE, '~'))"
}

# 表示するときはユーザー名を伏せる
Write-Host "対象: $($root.Replace($env:USERPROFILE, '~'))"

if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules'))) {
	Write-Host '依存が入っていません。npm install を実行します'
	Push-Location $root
	try { npm install } finally { Pop-Location }
	if ($LASTEXITCODE -ne 0) { throw 'npm install に失敗しました' }
}

# 絞り込みがあればファイル単位、無ければ tests フォルダごと
$targets = if ($Filter) {
	$found = @(Get-ChildItem -LiteralPath $testDir -Filter "*$Filter*.test.ts")
	if ($found.Count -eq 0) { throw "$Filter に当たるテストがありません" }
	$found | ForEach-Object { $_.FullName }
} else {
	, $testDir
}

# 空のまま node に渡すと探索範囲が広がる。渡す前に必ず確かめる
if (-not $targets -or @($targets).Count -eq 0) { throw '実行対象を決められませんでした' }

$nodeArgs = @('--test', '--test-concurrency=1') + $targets

Write-Host "実行: node --test --test-concurrency=1 （$(@($targets).Count) 件）"
Write-Host ''

# テストは自分の位置から相対を解決するが、念のため root を作業場所にする
Push-Location $root
try {
	& node @nodeArgs
	$code = $LASTEXITCODE
} finally {
	Pop-Location
}

if ($code -ne 0) {
	Write-Host ''
	Write-Host "node で失敗があります（終了コード $code）" -ForegroundColor Red
	exit $code
}

# bun が入っていれば、bun でも通ることを確かめる
if (Get-Command bun -ErrorAction SilentlyContinue) {
	Write-Host ''
	# $targets は 1 件だと配列でなく文字列になる。@targets と書くと
	# 文字列にはスプラッティングが効かず何も渡らない（bun がカレント配下を探し始める）。
	# node と同じく、配列を組んでから渡す
	$bunArgs = @('test') + $targets
	if ($bunArgs.Count -lt 2) { throw 'bun に渡す対象が空です' }
	Write-Host "実行: bun test （$(@($targets).Count) 件）"
	Push-Location $root
	try {
		& bun @bunArgs
		$code = $LASTEXITCODE
	} finally {
		Pop-Location
	}
	if ($code -ne 0) {
		Write-Host ''
		Write-Host "bun で失敗があります（終了コード $code）" -ForegroundColor Red
		exit $code
	}
}

Write-Host ''
Write-Host '全件通りました' -ForegroundColor Green
