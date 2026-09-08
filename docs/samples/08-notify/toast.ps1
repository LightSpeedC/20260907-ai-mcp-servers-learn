#requires -Version 5.1
<#
.SYNOPSIS
	Windows のトースト通知を 1 件出す。

.DESCRIPTION
	MCP サーバーから「処理が終わった」を人に知らせるために使う。
	WinRT の型を使うため Windows PowerShell 5.1 で実行する（pwsh 7 では型が見つからない）。

.EXAMPLE
	powershell -NoProfile -ExecutionPolicy Bypass -File toast.ps1 -Title "ビルド" -Message "成功しました"
#>
param(
	[Parameter(Mandatory = $true)][string]$Title,
	[Parameter(Mandatory = $true)][string]$Message
)

$ErrorActionPreference = 'Stop'

[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]

$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
	[Windows.UI.Notifications.ToastTemplateType]::ToastText02)

$texts = $xml.GetElementsByTagName('text')
[void]$texts.Item(0).AppendChild($xml.CreateTextNode($Title))
[void]$texts.Item(1).AppendChild($xml.CreateTextNode($Message))

# 送り主として登録済みのアプリ ID が要る。PowerShell のものを借りる
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'

$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)
$notifier.Show([Windows.UI.Notifications.ToastNotification]::new($xml))

Write-Output "通知を出した: $Title"
