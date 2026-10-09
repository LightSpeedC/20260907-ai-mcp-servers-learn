// 03 章「SDK で書き直す」と 05 章「Tools・Resources・Prompts」。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, sample, textOf } from './helpers/client.ts';

test('SDK 版は手書き版と同じ結果を返す', async () => {
	const client = await connect(sample('03-sdk/server.mjs'));

	try {
		const result = await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
		assert.equal(textOf(result), '5');
	} finally {
		await client.close();
	}
});

test('SDK は zod の定義から JSON Schema を作って送る', async () => {
	const client = await connect(sample('03-sdk/server.mjs'));

	try {
		const { tools } = await client.listTools();
		const schema = tools[0].inputSchema;
		assert.equal(schema.type, 'object');
		assert.equal(schema.properties.a.type, 'number');
		assert.deepEqual(schema.required.sort(), ['a', 'b']);
	} finally {
		await client.close();
	}
});

test('SDK は入力を検証し、型が違えばツールを呼ばない', async () => {
	const client = await connect(sample('03-sdk/server.mjs'));

	try {
		// 手書き版では自分で見ていた検証を SDK が肩代わりする
		const result = await client.callTool({ name: 'add', arguments: { a: 'あ', b: 3 } });
		assert.equal(result.isError, true);
	} finally {
		await client.close();
	}
});

test('Resources は URI で読む。テンプレートには値を埋められる', async () => {
	const client = await connect(sample('05-features/server.mjs'));

	try {
		const index = await client.readResource({ uri: 'note://index' });
		assert.match(index.contents[0].text, /2026-09-01/);

		const one = await client.readResource({ uri: 'note://2026-09-05' });
		assert.equal(one.contents[0].text, 'MCP の調査を始めた');

		// 無い日付でも例外にはせず、その旨を返す
		const none = await client.readResource({ uri: 'note://1999-01-01' });
		assert.match(none.contents[0].text, /ありません/);
	} finally {
		await client.close();
	}
});

test('Prompts は組み立てた文言を返す（実行はしない）', async () => {
	const client = await connect(sample('05-features/server.mjs'));

	try {
		const prompt = await client.getPrompt({
			name: 'summarize-notes',
			arguments: { style: '箇条書き' },
		});
		assert.equal(prompt.messages[0].role, 'user');
		assert.match(prompt.messages[0].content.text, /箇条書きでまとめてください/);
	} finally {
		await client.close();
	}
});

test('ツールの失敗は isError で返し、プロトコルのエラーにしない', async () => {
	const client = await connect(sample('05-features/server.mjs'));

	try {
		const result = await client.callTool({ name: 'divide', arguments: { a: 1, b: 0 } });
		assert.equal(result.isError, true);
		assert.match(textOf(result), /0 では割れません/);
	} finally {
		await client.close();
	}
});
