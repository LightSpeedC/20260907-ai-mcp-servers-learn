// 02 章「最小のサーバー」が仕様どおりに応答することを確かめる。
// SDK を使わずに書いたサーバーなので、ここが通れば手書きの JSON-RPC が正しい。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, sample, textOf } from './helpers/client.ts';

test('SDK 無しのサーバーでも initialize から tools/call まで通る', async () => {
	const client = await connect(sample('02-minimal/server.mjs'));

	try {
		// initialize は connect() の中で済んでいる。相手が名乗った内容を見る
		const info = client.getServerVersion();
		assert.equal(info.name, 'minimal');

		const { tools } = await client.listTools();
		assert.equal(tools.length, 1);
		assert.equal(tools[0].name, 'add');

		const result = await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
		assert.equal(textOf(result), '5');
	} finally {
		await client.close();
	}
});

test('引数が数値でなければ isError で返る（プロトコルのエラーにしない）', async () => {
	const client = await connect(sample('02-minimal/server.mjs'));

	try {
		const result = await client.callTool({ name: 'add', arguments: { a: 'あ', b: 3 } });
		// モデルが読んで直せるよう、失敗は結果として返す
		assert.equal(result.isError, true);
		assert.match(textOf(result), /数値/);
	} finally {
		await client.close();
	}
});

test('知らないメソッドは JSON-RPC のエラーで返る', async () => {
	const client = await connect(sample('02-minimal/server.mjs'));

	try {
		// このサーバーは resources を持たないので method not found になる
		await assert.rejects(() => client.listResources());
	} finally {
		await client.close();
	}
});
