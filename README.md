# MCP Server 学習資料

Claude Code・Codex・Antigravity CLI から呼び出せる MCP Server を、いちから自分で書けるようになるための資料

> 📅 作成: 2026-09-07 / 更新: 2026-10-09

MCP（Model Context Protocol）を知らないところから始めて、120 分で自分の MCP Server を書き、AI コーディング CLI に登録して呼び出せるところまで進みます。JavaScript の文法は知っている前提で、MCP の側だけを扱います。<br>載せてあるコードはすべて動かして確かめたものです。

## 本編

## 1. この資料について

### 対象読者

| 項目 | 前提 |
|---|---|
| MCP | まったく知らない |
| JavaScript | 文法は十分に知っている。`async`／`await`・モジュール・クラスの説明は要らない |
| AI コーディング CLI | Claude Code・Codex を「とりあえず使える」水準 |
| サーバー開発 | HTTP・プロセス・標準入出力は分かる。JSON-RPC は知らなくてよい |

### 到達点

- MCP が何を運ぶ規約なのかを、ホスト・クライアント・サーバーの関係で説明できる
- stdio の MCP Server を書き、Claude Code に登録して呼び出せる
- 同じサーバーを Streamable HTTP に載せ替えられる
- 処理の完了を伝える手段と、その限界が分かる
- 1 本のサーバーを複数のホストから共有できる
- 詰まったときにどこを見れば分かるか（ログ・仕様書・SDK の型定義）が分かる

### 扱う範囲

| 扱う | 扱わない |
|---|---|
| MCP Server の実装（Node.js / JavaScript） | MCP Client（ホスト側）の実装 |
| stdio と Streamable HTTP の 2 つのトランスポート | LLM そのものの仕組み |
| Tools・Resources・Prompts の使い分け | TypeScript の型システムの解説 |
| 3 つの CLI への登録方法 | MCP Server の商用ホスティング |
| 処理の完了を伝える通知とタスク | 認証（OAuth）を伴うリモート MCP |
| 同一 PC で 1 本のサーバーを共有する構成 |  |
| C# で単一 exe にする方法（付録） |  |

## 2. 手を動かす

### 用意する

```powershell
npm install
```

### サンプルを動かす

資料に出てくるサーバーは `docs/samples/` にあります。手で叩いて確かめられます。

```powershell
@(
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"手","version":"1.0"}}}'
'{"jsonrpc":"2.0","method":"notifications/initialized"}'
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
) -join "`n" | node docs/samples/02-minimal/server.mjs
```

### テストを流す

```powershell
node --test --test-concurrency=1 tests/
```

`tools/40_test/run-tests.cmd` をダブルクリックしても同じことができます。bun が入っていれば、続けて `bun test` でも流します。テストは TypeScript で書いてあり、Node.js・bun ともそのまま実行できます。

### 対象環境

| 対象 | 版 | 確認方法 |
|---|---|---|
| Node.js | v26.8.1 | `node --version` |
| npm | 11.19.0 | `npm --version` |
| @modelcontextprotocol/sdk | 1.30.0 | `npm view @modelcontextprotocol/sdk version` |
| MCP 仕様 | 2025-11-25 | [仕様サイト](https://modelcontextprotocol.io/specification/2025-11-25/) |
| OS | Windows 11 | パスの区切りと設定ファイルの場所が異なる箇所は本文で示す |

> [!NOTE]
> <strong>ホストによって喋る MCP の版が違います。</strong>実測では Claude Code が `2025-11-25`、Codex が `2025-06-18` でした。この資料は `2025-11-25` を基準にしています。詳しくは [01. 背景](docs/01-背景.md)。

## 3. 置き場

| フォルダ | 中身 |
|---|---|
| `docs/` | 学習資料の本編と付録 |
| `docs/samples/` | 資料に載せたサンプルコード |
| `tests/` | サンプルを検証するテスト |
| `tools/40_test/` | テストの実行ランチャー |
| `notes/` | 作る側のための管理ドキュメント |
| `AGENTS.md` | AI エージェントにローカルルールを読ませる入口 |

### 作る側の資料

[MCP Server 学習資料 計画](notes/10_plan/p260907-01-MCP学習資料.md)

[課題](notes/40_issues/issues.md)

[ローカルルール](notes/90_rules/local-rules.md)

### 参考にした資料

| 資料 | 関係 |
|---|---|
| [MCP 仕様 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/) | 本資料の根拠。迷ったらこちらが正 |
| TypeScript 学習資料 | 構成と書き方を揃えている。型の話はこちらに譲る |
| PowerShell 学習資料 | 構成と書き方を揃えている |
