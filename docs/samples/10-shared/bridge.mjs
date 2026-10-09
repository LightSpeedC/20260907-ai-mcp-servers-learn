// stdio ブリッジ
//
// ホストからは stdio のサーバーに見えるが、中身は HTTP の本体へ中継するだけ。
// これを挟むと、ホスト側の設定を stdio のまま変えずに 1 本のサーバーを共有できる。
//
//   Claude Code ──stdio──▶ bridge ──HTTP──▶ 常駐サーバー
//   Codex       ──stdio──▶ bridge ──┘
//
// 中継先は引数 --target で指定する（既定 http://localhost:3333/mcp）。
// 環境変数にしないのは、プロセス一覧に出ず、どのブリッジがどこへ繋いでいるか見分けられないため。

import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
	options: { target: { type: 'string', default: 'http://localhost:3333/mcp' } },
});
const TARGET = values.target;

process.title = `memo-bridge:${new URL(TARGET).port || '80'}`;

// stdout は JSON-RPC 専用。ログは stderr へ
function log(...args) {
	console.error('[bridge]', ...args);
}

function send(text) {
	process.stdout.write(text + '\n');
}

// Streamable HTTP の応答は JSON か SSE のどちらか。
// SSE のときは data: の行を取り出す
function extractMessages(contentType, body) {
	if (contentType.includes('text/event-stream')) {
		return body.split('\n')
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trim())
			.filter(Boolean);
	}
	return body.trim() ? [body.trim()] : [];
}

async function forward(line) {
	const res = await fetch(TARGET, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			// どちらの形で返してもよい、と伝える
			accept: 'application/json, text/event-stream',
		},
		body: line,
	});

	// 通知を中継したときは本文が無い（202 が返る）
	if (res.status === 202) return;

	const body = await res.text();
	for (const message of extractMessages(res.headers.get('content-type') ?? '', body)) {
		send(message);
	}
}

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
	if (!line.trim()) return;

	forward(line).catch((err) => {
		log('中継に失敗:', err.message);

		// 応答を待っているホストを固まらせないよう、エラーを返す。
		// 通知（id 無し）には返さない
		let id;
		try { id = JSON.parse(line).id; } catch { /* 壊れた行は無視 */ }
		if (id === undefined) return;

		send(JSON.stringify({
			jsonrpc: '2.0',
			id,
			error: { code: -32603, message: `本体へ中継できない: ${err.message}` },
		}));
	});
});

log(`中継先: ${TARGET}`);
