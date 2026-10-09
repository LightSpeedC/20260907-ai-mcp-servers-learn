// 10 章「プロセス共有」。
// stdio ブリッジを挟んでも、直に繋いだときと同じように使えることを確かめる。

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { connect, sample, startHttpMemo, textOf, tmp } from './helpers/client.ts';

const PORT = 3399;
const TARGET = `http://localhost:${PORT}/mcp`;
const MEMO_FILE = tmp('memo-shared.jsonl');

let http: ChildProcess | undefined;

before(async () => {
	await rm(MEMO_FILE, { force: true });
	http = await startHttpMemo(PORT, MEMO_FILE);
});

after(() => http?.kill());

/** 中継先は環境変数ではなく --target で渡す */
function bridge() {
	return connect(sample('10-shared/bridge.mjs'), { args: ['--target', TARGET] });
}

test('ブリッジ越しでもツールの一覧が取れる', async () => {
	const client = await bridge();

	try {
		const { tools } = await client.listTools();
		assert.deepEqual(tools.map((t) => t.name).sort(), ['memo_add', 'memo_search']);
	} finally {
		await client.close();
	}
});

test('2 本のブリッジが同じ本体を見ている（片方で書いた内容が他方で読める）', async () => {
	const a = await bridge();
	const b = await bridge();

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
			args: ['--target', 'http://localhost:3397/mcp'],
		}),
		/中継できない/,
	);
});
