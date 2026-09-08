// 10 章「プロセス共有」。
// stdio ブリッジを挟んでも、直に繋いだときと同じように使えることを確かめる。

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { connect, sample, textOf, tmp } from './helpers/client.mjs';

const PORT = 3399;
const MEMO_FILE = tmp('memo-shared.jsonl');

let http;

/** 本体（HTTP のメモサーバー）を起こし、応答できるようになるまで待つ */
before(async () => {
	await rm(MEMO_FILE, { force: true });

	http = spawn(process.execPath, [sample('07-http/server.mjs')], {
		env: { ...process.env, PORT: String(PORT), MEMO_FILE },
		stdio: 'ignore',
	});

	// 待ち受けが始まるまで叩いて確かめる
	for (let i = 0; i < 40; i++) {
		try {
			await fetch(`http://localhost:${PORT}/mcp`, { method: 'POST' });
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 250));
		}
	}
	throw new Error('本体が起動しなかった');
});

after(() => http?.kill());

test('ブリッジ越しでもツールの一覧が取れる', async () => {
	const client = await connect(sample('10-shared/bridge.mjs'), {
		env: { MCP_TARGET: `http://localhost:${PORT}/mcp` },
	});

	try {
		const { tools } = await client.listTools();
		assert.deepEqual(tools.map((t) => t.name).sort(), ['memo_add', 'memo_search']);
	} finally {
		await client.close();
	}
});

test('2 本のブリッジが同じ本体を見ている（片方で書いた内容が他方で読める）', async () => {
	const a = await connect(sample('10-shared/bridge.mjs'), {
		env: { MCP_TARGET: `http://localhost:${PORT}/mcp` },
	});
	const b = await connect(sample('10-shared/bridge.mjs'), {
		env: { MCP_TARGET: `http://localhost:${PORT}/mcp` },
	});

	try {
		const mark = `共有の確認 ${Date.now()}`;
		await a.callTool({ name: 'memo_add', arguments: { text: mark } });

		// 別のブリッジから探しても見つかる
		const found = await b.callTool({ name: 'memo_search', arguments: { query: '共有の確認' } });
		assert.match(textOf(found), new RegExp(mark));
	} finally {
		await a.close();
		await b.close();
	}
});

test('本体が落ちているときは接続の時点で失敗する（固まらない）', async () => {
	// initialize の中継に失敗するので、接続そのものが成立しない。
	// 待たされ続けるより、ここで落ちたほうが原因が分かりやすい
	await assert.rejects(
		() => connect(sample('10-shared/bridge.mjs'), {
			// 誰も待ち受けていないポート
			env: { MCP_TARGET: 'http://localhost:3397/mcp' },
		}),
		/中継できない/,
	);
});
