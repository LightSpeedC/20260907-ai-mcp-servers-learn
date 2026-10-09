// 06 章「メモサーバー」と 07 章「Streamable HTTP」。
// 同じ中身が stdio でも HTTP でも同じように動くことを確かめる。

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { connect, sample, startHttpMemo, textOf, tmp } from './helpers/client.ts';

const STDIO_FILE = tmp('memo-stdio.jsonl');
const HTTP_FILE = tmp('memo-http-test.jsonl');
const PORT = 3398;

test('何も書いていなければ、その旨を返す', async () => {
	await rm(STDIO_FILE, { force: true });
	const client = await connect(sample('06-memo/server.mjs'), { env: { MEMO_FILE: STDIO_FILE } });

	try {
		const res = await client.readResource({ uri: 'memo://all' });
		assert.equal(res.contents[0].text, 'まだメモはありません');
	} finally {
		await client.close();
	}
});

test('書いたメモは探せる。札でも探せる', async () => {
	await rm(STDIO_FILE, { force: true });
	const client = await connect(sample('06-memo/server.mjs'), { env: { MEMO_FILE: STDIO_FILE } });

	try {
		await client.callTool({
			name: 'memo_add',
			arguments: { text: 'stdio と HTTP の違いを整理した', tags: ['mcp'] },
		});
		await client.callTool({ name: 'memo_add', arguments: { text: '関係のないメモ' } });

		// 本文で探す
		const byText = await client.callTool({ name: 'memo_search', arguments: { query: 'stdio' } });
		assert.match(textOf(byText), /1 件のうち 1 件/);

		// 札で探す
		const byTag = await client.callTool({ name: 'memo_search', arguments: { query: 'mcp' } });
		assert.match(textOf(byTag), /整理した/);

		// 無いものは無いと返す（例外にしない）
		const none = await client.callTool({ name: 'memo_search', arguments: { query: 'ない語' } });
		assert.match(textOf(none), /ありません/);
	} finally {
		await client.close();
	}
});

test('何度実行しても同じ結果になる（前の実行が残らない）', async () => {
	await rm(STDIO_FILE, { force: true });

	for (let i = 0; i < 2; i++) {
		const client = await connect(sample('06-memo/server.mjs'), { env: { MEMO_FILE: STDIO_FILE } });
		try {
			await client.callTool({ name: 'memo_add', arguments: { text: `${i} 回目` } });
			const res = await client.callTool({ name: 'memo_search', arguments: { query: '回目' } });
			// 消してから始めているので、件数は積み上がる
			assert.match(textOf(res), new RegExp(`${i + 1} 件のうち`));
		} finally {
			await client.close();
		}
	}
});

// ── ここから HTTP 版 ──────────────────────────────────────

let http: ChildProcess | undefined;

before(async () => {
	await rm(HTTP_FILE, { force: true });
	http = await startHttpMemo(PORT, HTTP_FILE);
});

after(() => http?.kill());

test('HTTP 版でも stdio 版と同じツールが使える', async () => {
	const client = new Client({ name: 'tests', version: '1.0.0' }, { capabilities: {} });
	const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${PORT}/mcp`));

	try {
		await client.connect(transport);

		const { tools } = await client.listTools();
		assert.deepEqual(tools.map((t) => t.name).sort(), ['memo_add', 'memo_search']);

		await client.callTool({ name: 'memo_add', arguments: { text: 'HTTP から書いた' } });
		const found = await client.callTool({ name: 'memo_search', arguments: { query: 'HTTP' } });
		assert.match(textOf(found), /HTTP から書いた/);
	} finally {
		await client.close();
	}
});
