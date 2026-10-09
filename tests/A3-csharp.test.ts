// 付録 A3「単一 exe にする」。
// C# で書いたサーバーが、Node 版と同じ応答を返すことを確かめる。
//
// mcp-server.exe が無いときは飛ばす（csc.exe が無い環境でもテストが赤くならないように）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { connect, sample, textOf } from './helpers/client.ts';

const EXE = sample('A3-csharp/mcp-server.exe');
const skip = existsSync(EXE) ? false : 'mcp-server.exe が無い（build.cmd を実行すると作られる）';

test('C# 版でもツールの一覧と実行が通る', { skip }, async () => {
	const client = await connect(EXE, { command: EXE });

	try {
		const info = client.getServerVersion();
		assert.equal(info.name, 'csharp');

		const { tools } = await client.listTools();
		assert.equal(tools.length, 1);
		assert.equal(tools[0].name, 'add');

		const result = await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
		assert.equal(textOf(result), '5');
	} finally {
		await client.close();
	}
});

test('C# 版でも日本語が壊れない', { skip }, async () => {
	const client = await connect(EXE, { command: EXE });

	try {
		// BOM を付けずに UTF-8 で書き出しているかの確認でもある
		const { tools } = await client.listTools();
		assert.equal(tools[0].description, '2 つの数を足す');

		const result = await client.callTool({ name: 'add', arguments: { a: 'あ', b: 3 } });
		assert.equal(result.isError, true);
		assert.match(textOf(result), /数値を渡してください/);
	} finally {
		await client.close();
	}
});

test('C# 版でも小数を扱える', { skip }, async () => {
	const client = await connect(EXE, { command: EXE });

	try {
		const result = await client.callTool({ name: 'add', arguments: { a: 1.5, b: 2.25 } });
		assert.equal(textOf(result), '3.75');
	} finally {
		await client.close();
	}
});
